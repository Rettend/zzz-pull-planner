import type { PhasePlan, PlannerInputs, Scenario } from '~/lib/planner'
import { computeChannelBreakdown, roundToTarget } from '~/utils/plan'

function formatNumber(n: number): string {
  return String(Math.round(n))
}

function buildBreakdownEquation(
  pityStart: number,
  parts: number[],
): string {
  return `-${Math.max(0, pityStart)}${parts.map(v => `+${v}`).join('')}`
}

export function formatPlanCopyText(
  inputs: PlannerInputs,
  scenario: Scenario,
  selectedTargets: { name: string, channel: 'agent' | 'engine' }[],
  plan: PhasePlan,
): string {
  const lines: string[] = []
  lines.push(`Scenario: ${scenario}`)
  lines.push('')
  lines.push('Inputs:')
  lines.push(`- Pulls on hand (P0): ${formatNumber(inputs.pullsOnHand)}`)
  lines.push(`- Income Phase 1 (I1): ${formatNumber(inputs.incomePhase1)}`)
  lines.push(`- Income Phase 2 (I2): ${formatNumber(inputs.incomePhase2)}`)
  lines.push(`- Agent pity (pA): ${formatNumber(inputs.pityAgentStart)}${inputs.guaranteedAgentStart ? ' (guaranteed)' : ''}`)
  lines.push(`- W-Engine pity (pW): ${formatNumber(inputs.pityEngineStart)}${inputs.guaranteedEngineStart ? ' (guaranteed)' : ''}`)
  lines.push('')
  lines.push('Targets (in order):')
  if (selectedTargets.length === 0) {
    lines.push('(none)')
  }
  else {
    selectedTargets.forEach((t, idx) => {
      lines.push(`${idx + 1}. ${t.name} [${t.channel === 'agent' ? 'Agent' : 'W-Engine'}]`)
    })
  }
  lines.push('')
  lines.push('Plan:')
  lines.push('Phase 1:')
  lines.push(`- Budget start: ${formatNumber(plan.phase1.startBudget)}`)
  lines.push(`- Budget end: ${formatNumber(plan.phase1.endBudget)}`)
  lines.push(`- Success probability (start): ${Math.round((plan.phase1.successProbStart ?? 0) * 100)}%`)
  lines.push(`- Success probability (end): ${Math.round((plan.phase1.successProbEnd ?? 0) * 100)}%`)
  lines.push(`- Agents cost: ${formatNumber(plan.phase1.agentCost)} (${plan.phase1.canAffordAgentStart ? 'affordable at start' : 'not met at start'} / ${plan.phase1.canAffordAgentEnd ? 'affordable at end' : 'not met at end'})`)
  {
    const br = computeChannelBreakdown(1, 'agent', plan, scenario, inputs)
    if (br) {
      const raw = br.parts.map(p => p.value)
      const disp = Math.round(plan.phase1.agentCost)
      const target = disp > 0 ? disp : Math.round(raw.reduce((a, b) => a + b, 0))
      const rounded = roundToTarget(raw, target)
      const eq = buildBreakdownEquation(inputs.pityAgentStart, rounded)
      lines.push(`  = ${eq}${disp === 0 ? ' (not funded)' : ''}`)
    }
  }
  lines.push(`- Engines cost: ${formatNumber(plan.phase1.engineCost)} (${plan.phase1.canAffordEngineStart ? 'affordable at start' : 'not met at start'} / ${plan.phase1.canAffordEngineEnd ? 'affordable at end' : 'not met at end'})`)
  {
    const br = computeChannelBreakdown(1, 'engine', plan, scenario, inputs)
    if (br) {
      const raw = br.parts.map(p => p.value)
      const disp = Math.round(plan.phase1.engineCost)
      const target = disp > 0 ? disp : Math.round(raw.reduce((a, b) => a + b, 0))
      const rounded = roundToTarget(raw, target)
      const eq = buildBreakdownEquation(inputs.pityEngineStart, rounded)
      lines.push(`  = ${eq}${disp === 0 ? ' (not funded)' : ''}`)
    }
  }
  lines.push(`- Engines spend (start): ${formatNumber(plan.phase1.engineSpendStart)}`)
  lines.push(`- Engines spend (end): ${formatNumber(plan.phase1.engineSpendEnd)}`)
  lines.push(`- Reserve for Phase 2: ${formatNumber(plan.phase1.reserveForPhase2)}`)
  lines.push(`- Carry to Phase 2 (start): ${formatNumber(plan.phase1.carryToPhase2Start)}`)
  lines.push(`- Carry to Phase 2 (end): ${formatNumber(plan.phase1.carryToPhase2End)}`)
  lines.push('')
  lines.push('Phase 2:')
  lines.push(`- Budget start: ${formatNumber(plan.phase2.startBudget)}`)
  lines.push(`- Budget end: ${formatNumber(plan.phase2.endBudget)}`)
  lines.push(`- Success probability (start): ${Math.round((plan.phase2.successProbStart ?? 0) * 100)}%`)
  lines.push(`- Success probability (end): ${Math.round((plan.phase2.successProbEnd ?? 0) * 100)}%`)
  lines.push(`- Agents cost: ${formatNumber(plan.phase2.agentCost)} (${plan.phase2.canAffordAgentStart ? 'affordable at start' : 'not met at start'} / ${plan.phase2.canAffordAgent ? 'affordable at end' : 'not met at end'})`)
  {
    const br = computeChannelBreakdown(2, 'agent', plan, scenario, inputs)
    if (br) {
      const raw = br.parts.map(p => p.value)
      const disp = Math.round(plan.phase2.agentCost)
      const target = disp > 0 ? disp : Math.round(raw.reduce((a, b) => a + b, 0))
      const rounded = roundToTarget(raw, target)
      const eq = buildBreakdownEquation(0, rounded)
      lines.push(`  = ${eq}${disp === 0 ? ' (not funded)' : ''}`)
    }
  }
  lines.push(`- Engines cost: ${formatNumber(plan.phase2.engineCost)} (${plan.phase2.canAffordEngineAfterAgentStart ? 'affordable at start' : 'not met at start'} / ${plan.phase2.canAffordEngineAfterAgent ? 'affordable at end' : 'not met at end'})`)
  {
    const br = computeChannelBreakdown(2, 'engine', plan, scenario, inputs)
    if (br) {
      const raw = br.parts.map(p => p.value)
      const disp = Math.round(plan.phase2.engineCost)
      const target = disp > 0 ? disp : Math.round(raw.reduce((a, b) => a + b, 0))
      const rounded = roundToTarget(raw, target)
      const eq = buildBreakdownEquation(Math.max(0, plan.phase2.enginePityStart), rounded)
      lines.push(`  = ${eq}${disp === 0 ? ' (not funded)' : ''}`)
    }
  }
  lines.push('')
  const fundedAgentsList = selectedTargets.filter(t => t.channel === 'agent' && plan.fundedTargets.includes(t.name)).map(t => t.name)
  const fundedEnginesList = selectedTargets.filter(t => t.channel === 'engine' && plan.fundedTargets.includes(t.name)).map(t => t.name)
  const missed = selectedTargets.filter(t => !plan.fundedTargets.includes(t.name)).map(t => t.name)
  lines.push('Totals:')
  lines.push(`- Agents: ${formatNumber(plan.totals.agentsGot)} of ${selectedTargets.filter(t => t.channel === 'agent').length}`)
  lines.push(`- W-Engines: ${formatNumber(plan.totals.enginesGot)} of ${selectedTargets.filter(t => t.channel === 'engine').length}`)
  lines.push(`- Pulls left end: ${formatNumber(plan.totals.pullsLeftEnd)}`)
  if (fundedAgentsList.length)
    lines.push(`- Funded Agents: ${fundedAgentsList.join(', ')}`)
  if (fundedEnginesList.length)
    lines.push(`- Funded W-Engines: ${fundedEnginesList.join(', ')}`)
  if (missed.length)
    lines.push(`- Not funded yet: ${missed.join(', ')}`)
  if ((plan.phase1.shortfallEnd ?? 0) > 0)
    lines.push(`- You would need ${formatNumber(plan.phase1.shortfallEnd ?? 0)} more pulls at the end of Phase 1 to fund all Phase 1 selections.`)
  if ((plan.phase2.shortfallEnd ?? 0) > 0)
    lines.push(`- You would need ${formatNumber(plan.phase2.shortfallEnd ?? 0)} more pulls at the end of Phase 2 to get everything.`)

  return lines.join('\n')
}
