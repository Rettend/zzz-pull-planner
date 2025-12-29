import type { PhasePlan, PlannerSettings, Scenario } from '~/lib/planner'
import { formatSlug } from '~/utils'
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
  inputs: PlannerSettings,
  scenario: Scenario,
  selectedTargets: { name: string, channel: 'agent' | 'engine' }[],
  plan: PhasePlan,
  checkRarity?: (name: string) => number,
  resolveName?: (name: string, channel: 'agent' | 'engine') => string,
): string {
  const getName = (name: string, channel: 'agent' | 'engine') => {
    return resolveName ? resolveName(name, channel) : formatSlug(name)
  }

  const lines: string[] = []
  lines.push(`Scenario: ${scenario}`)
  lines.push('')
  lines.push('Inputs:')
  lines.push(`- Pulls on hand (P0): ${formatNumber(inputs.pullsOnHand)}`)

  Object.entries(inputs.phaseSettings).forEach(([_range, ps], idx) => {
    lines.push(`- Income Phase ${idx + 1} (I${idx + 1}): ${formatNumber(ps.income)}`)
  })

  lines.push(`- Agent pity (pA): ${formatNumber(inputs.pityAgentS)}${inputs.guaranteedAgentS ? ' (guaranteed)' : ''}`)
  lines.push(`- W-Engine pity (pW): ${formatNumber(inputs.pityEngineS)}${inputs.guaranteedEngineS ? ' (guaranteed)' : ''}`)
  lines.push('')
  lines.push('Targets (in order):')
  if (selectedTargets.length === 0) {
    lines.push('(none)')
  }
  else {
    selectedTargets.forEach((t, idx) => {
      lines.push(`${idx + 1}. ${getName(t.name, t.channel)} [${t.channel === 'agent' ? 'Agent' : 'W-Engine'}]`)
    })
  }
  lines.push('')
  lines.push('Plan:')

  plan.phases.forEach((phase, idx) => {
    lines.push(`Phase ${idx + 1}:`)
    lines.push(`- Budget start: ${formatNumber(phase.startBudget)}`)
    lines.push(`- Budget end: ${formatNumber(phase.endBudget)}`)
    lines.push(`- Success probability (start): ${Math.round((phase.successProbStart ?? 0) * 100)}%`)
    lines.push(`- Success probability (end): ${Math.round((phase.successProbEnd ?? 0) * 100)}%`)

    lines.push(`- Agents cost: ${formatNumber(phase.agentCost)} (${phase.canAffordAgentStart ? 'affordable at start' : 'not met at start'} / ${phase.canAffordAgentEnd ? 'affordable at end' : 'not met at end'})`)
    {
      const names = phase.itemDetails.filter(i => i.channel === 'agent').map(i => i.name)
      const br = computeChannelBreakdown(idx, 'agent', plan, scenario, inputs, names, checkRarity)
      if (br) {
        const raw = br.parts.map(p => p.value)
        const disp = Math.round(phase.agentCost)
        const target = disp > 0 ? disp : Math.round(raw.reduce((a, b) => a + b, 0))
        const rounded = roundToTarget(raw, target)
        const eq = buildBreakdownEquation(br.pity, rounded)
        lines.push(`  = ${eq}${disp === 0 ? ' (not funded)' : ''}`)
      }
    }

    lines.push(`- Engines cost: ${formatNumber(phase.engineCost)} (${phase.canAffordEngineStart ? 'affordable at start' : 'not met at start'} / ${phase.canAffordEngineEnd ? 'affordable at end' : 'not met at end'})`)
    {
      const names = phase.itemDetails.filter(i => i.channel === 'engine').map(i => i.name)
      const br = computeChannelBreakdown(idx, 'engine', plan, scenario, inputs, names, checkRarity)
      if (br) {
        const raw = br.parts.map(p => p.value)
        const disp = Math.round(phase.engineCost)
        const target = disp > 0 ? disp : Math.round(raw.reduce((a, b) => a + b, 0))
        const rounded = roundToTarget(raw, target)
        const eq = buildBreakdownEquation(br.pity, rounded)
        lines.push(`  = ${eq}${disp === 0 ? ' (not funded)' : ''}`)
      }
    }

    lines.push(`- Engines spend (start): ${formatNumber(phase.engineSpendStart)}`)
    lines.push(`- Engines spend (end): ${formatNumber(phase.engineSpendEnd)}`)
    lines.push(`- Reserve for Next: ${formatNumber(phase.reserveForNextPhase)}`)
    lines.push(`- Carry to Next (start): ${formatNumber(phase.carryToNextPhaseStart)}`)
    lines.push(`- Carry to Next (end): ${formatNumber(phase.carryToNextPhaseEnd)}`)
    lines.push('')
  })

  const fundedAgentsList = selectedTargets.filter(t => t.channel === 'agent' && plan.fundedTargets.includes(t.name)).map(t => getName(t.name, t.channel))
  const fundedEnginesList = selectedTargets.filter(t => t.channel === 'engine' && plan.fundedTargets.includes(t.name)).map(t => getName(t.name, t.channel))
  const missed = selectedTargets.filter(t => !plan.fundedTargets.includes(t.name)).map(t => getName(t.name, t.channel))

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

  plan.phases.forEach((phase, idx) => {
    if ((phase.shortfallEnd ?? 0) > 0)
      lines.push(`- You would need ${formatNumber(phase.shortfallEnd ?? 0)} more pulls at the end of Phase ${idx + 1} to fund all selections up to that point.`)
  })

  return lines.join('\n')
}
