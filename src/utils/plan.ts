import type { PhasePlan, PlannerInputs, Scenario } from '~/lib/planner'
import { resolveAgent, resolveWEngine } from '~/lib/constants'
import { costAtScenario, costStatsFromPmf, featuredCostPmf, firstSPmfFromHazard, getDefaultHazard, hazardWithPityOffset } from '~/lib/probability'

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
  phase: 1 | 2,
  channel: Channel,
  plan: PhasePlan,
  scenario: Scenario,
  inputs: PlannerInputs,
  targetNames?: string[],
): ChannelBreakdownResult | null {
  const luckMode = inputs.luckMode ?? 'realistic'
  const q = getFeaturedProbability(luckMode, channel)
  const names = (targetNames && targetNames.length ? targetNames : (phase === 1 ? plan.fundedTargetsPhase1 : plan.fundedTargetsPhase2))
    .filter(n => channel === 'agent' ? Boolean(resolveAgent(n)) : Boolean(resolveWEngine(n)))
  if (names.length === 0)
    return null

  const { hazards } = getDefaultHazard(channel)
  let pity = phase === 1
    ? (channel === 'agent' ? inputs.pityAgentStart : inputs.pityEngineStart)
    : (channel === 'agent' ? (plan.phase2.agentPityStart ?? 0) : (plan.phase2.enginePityStart ?? 0))
  let guaranteed = phase === 1
    ? (channel === 'agent' ? inputs.guaranteedAgentStart : inputs.guaranteedEngineStart)
    : (channel === 'agent' ? (plan.phase2.agentGuaranteedStart ?? false) : (plan.phase2.engineGuaranteedStart ?? false))

  const parts: BreakdownPart[] = []
  for (const _ of names) {
    const h1 = hazardWithPityOffset(hazards, Math.max(0, pity))
    const first = costAtScenario(scenario, costStatsFromPmf(firstSPmfFromHazard(h1)))
    const total = guaranteed
      ? first
      : costAtScenario(scenario, costStatsFromPmf(featuredCostPmf(channel, Math.max(0, pity), false, q, hazards)))
    const off = Math.max(0, total - first)
    parts.push({ value: first, kind: 'first' })
    if (off > 0)
      parts.push({ value: off, kind: 'off' })
    pity = 0
    guaranteed = false
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
