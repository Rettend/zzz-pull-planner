import type { ChannelType } from '~/lib/constants'
import type { PhasePlan, PlannerInputs, Scenario } from '~/lib/planner'
import type { TargetAggregate } from '~/stores/targets'
import type { BreakdownPart } from '~/utils/plan'
import { BANNERS } from '~/lib/constants'
import { computeChannelBreakdown, roundToTarget } from '~/utils/plan'

export type PhaseIndex = 1 | 2

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
}

function rangeKey(b: { start: string, end: string }): string {
  return `${b.start}→${b.end}`
}

export function buildPhaseRanges(): string[] {
  return Array.from(new Set(BANNERS.map(rangeKey))).sort((a, b) => a.localeCompare(b))
}

export function phaseOfName(name: string, ranges: string[]): PhaseIndex {
  const banner = BANNERS.find(x => x.featured === name)
  if (!banner)
    return 1
  const idx = ranges.indexOf(rangeKey(banner))
  return idx <= 0 ? 1 : 2
}

export function namesForPhaseChannel(
  selectedTargets: SelectedTargetInput[],
  ranges: string[],
  phase: PhaseIndex,
  channel: ChannelType,
): string[] {
  return selectedTargets
    .filter(target => phaseOfName(target.name, ranges) === phase && target.channel === channel)
    .map(target => target.name)
}

export function describeScenario(scenario: Scenario): string {
  switch (scenario) {
    case 'p50':
      return 'Risk: p50 is the median — half the time you\'ll spend more, half less.'
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
  groupedTargets: TargetAggregate[]
  funded: Map<string, number>
  channel: ChannelType
}): FundingSummary {
  const { groupedTargets, funded, channel } = params
  const fundedList: string[] = []
  const missedList: string[] = []

  for (const target of groupedTargets.filter(t => t.channel === channel)) {
    const fundedMax = funded.get(target.name) ?? -1
    const desiredMax = target.count - 1
    if (funded.has(target.name)) {
      fundedList.push(fundedMax <= 0 ? target.name : `${target.name} M${fundedMax}`)
    }
    if (desiredMax < 0)
      continue
    if (fundedMax < desiredMax) {
      if (desiredMax === 0 || fundedMax < 0) {
        missedList.push(target.name)
        continue
      }
      const start = Math.max(0, fundedMax + 1)
      if (start > desiredMax) {
        missedList.push(target.name)
        continue
      }
      missedList.push(`${target.name} M${start}-M${desiredMax}`)
    }
  }

  return { funded: fundedList, missed: missedList }
}

export function planCost(plan: PhasePlan, phase: PhaseIndex, channel: ChannelType): number {
  if (phase === 1)
    return channel === 'agent' ? plan.phase1.agentCost : plan.phase1.engineCost
  return channel === 'agent' ? plan.phase2.agentCost : plan.phase2.engineCost
}

export function calculateDisplayedCost(params: {
  plan: PhasePlan
  phase: PhaseIndex
  channel: ChannelType
  scenario: Scenario
  inputs: PlannerInputs
  selectedTargets: SelectedTargetInput[]
  ranges: string[]
}): number {
  const { plan, phase, channel, scenario, inputs, selectedTargets, ranges } = params
  const actual = Math.round(planCost(plan, phase, channel))
  if (actual > 0)
    return actual
  const names = namesForPhaseChannel(selectedTargets, ranges, phase, channel)
  const breakdown = computeChannelBreakdown(phase, channel, plan, scenario, inputs, names)
  if (!breakdown)
    return 0
  const raw = breakdown.parts.map(p => p.value)
  return Math.round(raw.reduce((a, b) => a + b, 0))
}

export function channelBreakdownParts(params: {
  plan: PhasePlan
  phase: PhaseIndex
  channel: ChannelType
  scenario: Scenario
  inputs: PlannerInputs
  selectedTargets: SelectedTargetInput[]
  ranges: string[]
  displayedTotal: number
}): RoundedBreakdownPart[] | null {
  const { plan, phase, channel, scenario, inputs, selectedTargets, ranges, displayedTotal } = params
  const names = namesForPhaseChannel(selectedTargets, ranges, phase, channel)
  const breakdown = computeChannelBreakdown(phase, channel, plan, scenario, inputs, names)
  if (!breakdown)
    return null
  const rawValues = breakdown.parts.map(p => p.value)
  const sumRaw = Math.round(rawValues.reduce((a, b) => a + b, 0))
  const rounded = roundToTarget(rawValues, displayedTotal > 0 ? displayedTotal : sumRaw)
  return rounded.map((value, idx) => ({ value, kind: breakdown.parts[idx].kind }))
}
