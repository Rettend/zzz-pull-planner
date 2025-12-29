import type { Banner, ChannelType } from '~/lib/constants'
import type { PhasePlan, PlannerInputs, Scenario } from '~/lib/planner'
import type { ProfileTarget } from '~/stores/profiles'
import type { BreakdownPart } from '~/utils/plan'
import { computeChannelBreakdown } from '~/utils/plan'

export type PhaseIndex = number

export interface SelectedTargetInput {
  name: string
  channel: ChannelType
}

export interface FundingSummary {
  funded: string[]
  missed: string[]
}

export interface RoundedBreakdownPart {
  value: number
  kind: BreakdownPart['kind']
  met: boolean
}

function rangeKey(b: { start: string, end: string }): string {
  return `${b.start}→${b.end}`
}

export function buildPhaseRanges(banners: Banner[]): string[] {
  return Array.from(new Set(banners.map(rangeKey))).sort((a, b) => a.localeCompare(b))
}

export function phaseOfName(banners: Banner[], name: string, ranges: string[]): PhaseIndex {
  // Check S-rank (featured)
  const sFeaturedBanner = banners.find(x => x.featured === name)
  if (sFeaturedBanner) {
    const idx = ranges.indexOf(rangeKey(sFeaturedBanner))
    return idx < 0 ? 0 : idx
  }

  // Check A-rank (featuredARanks) - use latest banner if appears on multiple
  let aRankBanner: Banner | undefined
  for (const b of banners) {
    if (b.featuredARanks?.includes(name))
      aRankBanner = b // Keep updating to get the latest
  }

  if (aRankBanner) {
    const idx = ranges.indexOf(rangeKey(aRankBanner))
    return idx < 0 ? 0 : idx
  }

  return 0 // Default to first phase if not found
}

export function namesForPhaseChannel(
  banners: Banner[],
  selectedTargets: SelectedTargetInput[],
  ranges: string[],
  phase: PhaseIndex,
  channel: ChannelType,
): string[] {
  return selectedTargets
    .filter(target => phaseOfName(banners, target.name, ranges) === phase && target.channel === channel)
    .map(target => target.name)
}

export function describeScenario(scenario: Scenario): string {
  switch (scenario) {
    case 'p50':
      return 'Risk: p50 is the median; half the time you\'ll spend more, half less.'
    case 'p60':
      return 'Risk: p60 adds a small buffer over median; a realistic default for many players.'
    case 'p75':
      return 'Risk: p75 is a safe buffer; good if you want fewer surprises.'
    case 'p90':
      return 'Risk: p90 is very safe; plan for the unlucky case.'
    case 'ev':
      return 'EV: long-run average cost; useful benchmark, not a safety floor.'
    default:
      return 'Choose a risk level: higher p means a larger safety buffer.'
  }
}

export function describeLuckMode(mode: PlannerInputs['luckMode'] = 'realistic'): string {
  switch (mode) {
    case 'best':
      return 'Featured odds: q=1.0. Plan as if you always win the 50/50 or 75/25.'
    case 'worst':
      return 'Featured odds: q=0.0. Plan as if you always lose the 50/50 or 75/25.'
    default:
      return 'Featured odds: q=0.5 (Agents) / q=0.75 (W-Engines).'
  }
}

export function createFundedMindscapes(plan: PhasePlan): Map<string, number> {
  const funded = plan.fundedTargets
  const result = new Map<string, number>()

  for (const name of funded) {
    const current = result.get(name) ?? -1
    result.set(name, current + 1)
  }

  return result
}

export function computeFundingSummary(params: {
  sortedTargets: ProfileTarget[]
  funded: Map<string, number>
  channel: ChannelType
}): FundingSummary {
  const { sortedTargets, funded, channel } = params
  const fundedList: string[] = []
  const missedList: string[] = []

  for (const target of sortedTargets.filter(t => t.channelType === channel)) {
    const fundedMax = funded.get(target.targetId) ?? -1
    const desiredMax = target.count - 1
    if (funded.has(target.targetId))
      fundedList.push(fundedMax <= 0 ? target.targetId : `${target.targetId} M${fundedMax}`)

    if (desiredMax < 0)
      continue
    if (fundedMax < desiredMax) {
      if (desiredMax === 0 || fundedMax < 0) {
        missedList.push(target.targetId)
        continue
      }
      const start = Math.max(0, fundedMax + 1)
      if (start > desiredMax) {
        missedList.push(target.targetId)
        continue
      }
      missedList.push(`${target.targetId} M${start}-M${desiredMax}`)
    }
  }

  return { funded: fundedList, missed: missedList }
}

export function planCost(plan: PhasePlan, phase: PhaseIndex, channel: ChannelType): number {
  const p = plan.phases[phase]
  if (!p)
    return 0
  return channel === 'agent' ? p.agentCost : p.engineCost
}

export function calculateDisplayedCost(params: {
  banners: Banner[]
  plan: PhasePlan
  phase: PhaseIndex
  channel: ChannelType
  scenario: Scenario
  inputs: PlannerInputs
  selectedTargets: SelectedTargetInput[]
  ranges: string[]
  checkRarity?: (name: string) => number
}): number {
  const { banners, plan, phase, channel, scenario, inputs, selectedTargets, ranges, checkRarity } = params
  const actual = Math.round(planCost(plan, phase, channel))
  if (actual > 0)
    return actual
  const names = namesForPhaseChannel(banners, selectedTargets, ranges, phase, channel)
  const breakdown = computeChannelBreakdown(phase, channel, plan, scenario, inputs, names, checkRarity)
  if (!breakdown)
    return 0
  const raw = breakdown.parts.map(p => p.value)
  return Math.round(raw.reduce((a, b) => a + b, 0))
}

export function channelBreakdownParts(params: {
  plan: PhasePlan
  phase: PhaseIndex
  channel: ChannelType
  inputs: PlannerInputs
  scenario: Scenario
  checkRarity?: (name: string) => number
}): RoundedBreakdownPart[] | null {
  const { plan, phase, channel, inputs, scenario, checkRarity } = params
  const p = plan.phases[phase]
  if (!p)
    return null

  const items = p.itemDetails.filter(i => i.channel === channel)
  if (items.length === 0)
    return null

  const names = items.map(i => i.name)
  const breakdown = computeChannelBreakdown(phase, channel, plan, scenario, inputs, names, checkRarity)

  if (!breakdown)
    return null

  const result: RoundedBreakdownPart[] = []
  let itemIdx = 0

  for (let i = 0; i < breakdown.parts.length; i++) {
    const part = breakdown.parts[i]
    const item = items[itemIdx]

    if (!item)
      break

    result.push({
      value: Math.round(part.value),
      kind: part.kind,
      met: item.funded,
    })

    const nextPart = breakdown.parts[i + 1]
    if (part.kind === 'off') {
      itemIdx++
    }
    else if (part.kind === 'first') {
      if (!nextPart || nextPart.kind !== 'off')
        itemIdx++
    }
  }

  return result
}
