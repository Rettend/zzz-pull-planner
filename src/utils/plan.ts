import type { PhasePlan, PlannerInputs, Scenario } from '~/lib/planner'
import { costAtScenario, costStatsFromPmf, featuredCostPmf, firstSPmfFromHazard, geometricCostPmf, getARankHazard, getDefaultHazard, hazardWithPityOffset } from '~/lib/probability'

export type Channel = 'agent' | 'engine'

export interface BreakdownPart {
  value: number
  kind: 'first' | 'off'
}

export interface ChannelBreakdownResult {
  pity: number
  parts: BreakdownPart[]
  total: number
}

export function getFeaturedProbability(luckMode: PlannerInputs['luckMode'], channel: Channel): number {
  const mode = luckMode ?? 'realistic'
  if (channel === 'agent')
    return mode === 'best' ? 1 : mode === 'worst' ? 0 : 0.5
  return mode === 'best' ? 1 : mode === 'worst' ? 0 : 0.75
}

export function computeChannelBreakdown(
  phase: number,
  channel: Channel,
  plan: PhasePlan,
  scenario: Scenario,
  inputs: PlannerInputs,
  targetNames?: string[],
  checkRarity?: (name: string) => number,
): ChannelBreakdownResult | null {
  const luckMode = inputs.luckMode ?? 'realistic'
  const q = getFeaturedProbability(luckMode, channel)

  const phaseResult = plan.phases[phase]
  if (!phaseResult)
    return null

  const names = targetNames ?? phaseResult.boughtNames
  if (names.length === 0)
    return null

  const { hazards: sHazards } = getDefaultHazard(channel)
  const { hazards: aHazards } = getARankHazard(channel === 'agent' ? 0.094 : 0.150)

  let pity = 0
  let guaranteed = false

  if (phase === 0) {
    pity = channel === 'agent' ? inputs.pityAgentStart : inputs.pityEngineStart
    guaranteed = channel === 'agent' ? inputs.guaranteedAgentStart : inputs.guaranteedEngineStart
  }
  else {
    const prevPhase = plan.phases[phase - 1]
    if (prevPhase) {
      pity = channel === 'agent' ? prevPhase.agentPityEnd : prevPhase.enginePityEnd
      guaranteed = channel === 'agent' ? prevPhase.agentGuaranteedEnd : prevPhase.engineGuaranteedEnd
    }
  }

  const parts: BreakdownPart[] = []
  for (const name of names) {
    const rarity = checkRarity ? checkRarity(name) : 5

    if (rarity === 4) {
      // A-Rank Logic
      // const baseRate = channel === 'agent' ? 0.094 : 0.150 // Unused
      const winRate = 0.25
      let pSuccess = winRate
      
      if (guaranteed) {
        pSuccess = 0.5
      }

      if (luckMode === 'best')
        pSuccess = 1.0
      if (luckMode === 'worst')
        pSuccess = 0.10

      // For A-ranks, we don't track pity in the same granular way for the breakdown
      // We assume 0 pity start for each A-rank calculation as per planner logic
      const pmf = geometricCostPmf(aHazards, pSuccess, 0.999, Math.max(0, pity))
      const cost = costAtScenario(scenario, costStatsFromPmf(pmf))
      parts.push({ value: cost, kind: 'first' })
      
      // Reset for next
      pity = 0
      guaranteed = false
    }
    else {
      // S-Rank Logic
      const h1 = hazardWithPityOffset(sHazards, Math.max(0, pity))
      const first = costAtScenario(scenario, costStatsFromPmf(firstSPmfFromHazard(h1)))
      const total = guaranteed
        ? first
        : costAtScenario(scenario, costStatsFromPmf(featuredCostPmf(channel, Math.max(0, pity), false, q, sHazards)))
      const off = Math.max(0, total - first)
      parts.push({ value: first, kind: 'first' })
      if (off > 0)
        parts.push({ value: off, kind: 'off' })

      pity = 0
      guaranteed = false
    }
  }
  const total = parts.reduce((a, b) => a + b.value, 0)
  return { pity: Math.max(0, pity), parts, total }
}

export function roundToTarget(values: number[], target: number): number[] {
  const floors = values.map(v => Math.floor(v))
  const sumFloors = floors.reduce((a, b) => a + b, 0)
  const fracs = values.map((v, i) => ({ i, f: v - Math.floor(v) }))
  const result = floors.slice()
  const need = target - sumFloors
  if (need >= 0) {
    fracs.sort((a, b) => b.f - a.f)
    for (let k = 0; k < Math.min(need, result.length); k++) result[fracs[k].i] += 1
  }
  else {
    const ceils = values.map(v => Math.ceil(v))
    for (let i = 0; i < result.length; i++) result[i] = ceils[i]
    const sumCeils = result.reduce((a, b) => a + b, 0)
    const over = sumCeils - target
    fracs.sort((a, b) => a.f - b.f)
    for (let k = 0; k < Math.min(over, result.length); k++) result[fracs[k].i] -= 1
  }
  return result
}
