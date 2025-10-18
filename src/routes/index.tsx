import type { PhasePlan } from '~/lib/planner'
import { createMemo, createSignal, Show } from 'solid-js'
import { TargetPicker } from '~/components/TargetPicker'
import { Badge, boolInput, BudgetBar, CheckboxField, NumberField, numberInput, StatRow } from '~/components/ui'
import { computeTwoPhasePlan, emptyPlan } from '~/lib/planner'
import { useTargetsStore } from '~/stores/targets'
import { useUIStore } from '~/stores/ui'

export default function Home() {
  const [ui, actions] = useUIStore()
  const [targets] = useTargetsStore()
  const inputs = () => ui.local.plannerInputs
  const scenario = () => ui.local.scenario
  const phase1Timing = () => ui.local.phase1Timing
  const phase2Timing = () => ui.local.phase2Timing

  const selectedTargets = () => (targets?.selected ?? []).slice().sort((a, b) => a.priority - b.priority).map(t => ({ name: t.name, channel: t.channel }))

  const plan = createMemo<PhasePlan>(() => {
    try {
      return computeTwoPhasePlan(inputs(), scenario(), selectedTargets())
    }
    catch {
      return emptyPlan()
    }
  })

  const fundedSet = createMemo(() => new Set(plan().fundedTargets))
  const fundedAgents = createMemo(() => selectedTargets().filter(t => t.channel === 'agent' && fundedSet().has(t.name)).map(t => t.name))
  const missedAgents = createMemo(() => selectedTargets().filter(t => t.channel === 'agent' && !fundedSet().has(t.name)).map(t => t.name))
  const fundedEngines = createMemo(() => selectedTargets().filter(t => t.channel === 'engine' && fundedSet().has(t.name)).map(t => t.name))
  const missedEngines = createMemo(() => selectedTargets().filter(t => t.channel === 'engine' && !fundedSet().has(t.name)).map(t => t.name))

  const [copied, setCopied] = createSignal(false)

  function formatNumber(n: number): string {
    const rounded = Math.round((n + Number.EPSILON) * 100) / 100
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
  }

  function costExplain(N: number, pity: number, guaranteed: boolean, q: number): string {
    const s = scenario()
    const parts: string[] = []
    parts.push(`-${formatNumber(pity)}`)
    parts.push(formatNumber(N))
    let extra = 0
    if (s === 'expected') {
      extra = guaranteed ? 0 : (1 - q) * N
    }
    else if (s === 'worst') {
      extra = guaranteed ? 0 : N
    }
    if (extra > 0)
      parts.push(formatNumber(extra))
    return `(${parts.join('+')})`
  }

  function formatCopyText(): string {
    const i = inputs()
    const s = scenario()
    const sel = selectedTargets()
    const p = plan()
    const lines: string[] = []
    lines.push(`Scenario: ${s}`)
    lines.push('')
    lines.push('Inputs:')
    lines.push(`- N: ${formatNumber(i.N)}`)
    lines.push(`- Pulls on hand (P0): ${formatNumber(i.pullsOnHand)}`)
    lines.push(`- Income Phase 1 (I1): ${formatNumber(i.incomePhase1)}`)
    lines.push(`- Income Phase 2 (I2): ${formatNumber(i.incomePhase2)}`)
    lines.push(`- Agent pity (pA): ${formatNumber(i.pityAgentStart)}${i.guaranteedAgentStart ? ' (guaranteed)' : ''}`)
    lines.push(`- W-Engine pity (pW): ${formatNumber(i.pityEngineStart)}${i.guaranteedEngineStart ? ' (guaranteed)' : ''}`)
    lines.push(`- q Agent: ${formatNumber(i.qAgent)}`)
    lines.push(`- q W-Engine: ${formatNumber(i.qEngine)}`)
    lines.push('')
    lines.push('Targets (in order):')
    if (sel.length === 0) {
      lines.push('(none)')
    }
    else {
      sel.forEach((t, idx) => {
        lines.push(`${idx + 1}. ${t.name} [${t.channel === 'agent' ? 'Agent' : 'W-Engine'}]`)
      })
    }
    lines.push('')
    lines.push('Plan:')
    lines.push('Phase 1:')
    lines.push(`- Budget start: ${formatNumber(p.phase1.startBudget)}`)
    lines.push(`- Budget end: ${formatNumber(p.phase1.endBudget)}`)
    lines.push(`- Agents cost: ${formatNumber(p.phase1.agentCost)} (${p.phase1.canAffordAgentStart ? 'affordable at start' : 'not met at start'} / ${p.phase1.canAffordAgentEnd ? 'affordable at end' : 'not met at end'})`)
    lines.push(`- Engines spend (start): ${formatNumber(p.phase1.engineSpendStart)}`)
    lines.push(`- Engines spend (end): ${formatNumber(p.phase1.engineSpendEnd)}`)
    lines.push(`- Reserve for Phase 2: ${formatNumber(p.phase1.reserveForPhase2)}`)
    lines.push(`- Carry to Phase 2 (start): ${formatNumber(p.phase1.carryToPhase2Start)}`)
    lines.push(`- Carry to Phase 2 (end): ${formatNumber(p.phase1.carryToPhase2End)}`)
    lines.push('')
    lines.push('Phase 2:')
    lines.push(`- Budget start: ${formatNumber(p.phase2.startBudget)}`)
    lines.push(`- Budget end: ${formatNumber(p.phase2.endBudget)}`)
    lines.push(`- Agents cost: ${formatNumber(p.phase2.agentCost)} (${p.phase2.canAffordAgentStart ? 'affordable at start' : 'not met at start'} / ${p.phase2.canAffordAgent ? 'affordable at end' : 'not met at end'})`)
    lines.push(`- Engines cost: ${formatNumber(p.phase2.engineCost)} (${p.phase2.canAffordEngineAfterAgentStart ? 'affordable at start' : 'not met at start'} / ${p.phase2.canAffordEngineAfterAgent ? 'affordable at end' : 'not met at end'})`)
    lines.push('')
    lines.push(`Totals: Agents ${formatNumber(p.totals.agentsGot)}, Engines ${formatNumber(p.totals.enginesGot)}, Pulls left end ${formatNumber(p.totals.pullsLeftEnd)}`)
    return lines.join('\n')
  }

  async function onCopy() {
    try {
      const text = formatCopyText()
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    catch {
      setCopied(false)
    }
  }

  return (
    <main class="text-emerald-100 font-mono p-6 bg-zinc-900 min-h-screen relative">
      <div class="bg-[linear-gradient(transparent_1px,#18181b_1px),linear-gradient(90deg,transparent_1px,#18181b_1px)] bg-[size:32px_32px] opacity-20 pointer-events-none inset-0 absolute" />
      <div class="mx-auto max-w-7xl relative space-y-6">
        {/* Full-width selector panel */}
        <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 space-y-3">
          <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Select Targets</h2>
          <TargetPicker />
        </section>

        <div class="gap-6 grid lg:grid-cols-[1fr_2fr]">
          <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 space-y-4">
            <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Inputs</h2>
            <div class="gap-3 grid grid-cols-2">
              <NumberField label="N (pity cap)" min={1} {...numberInput(inputs, actions.setPlannerInput, 'N')} />
              <NumberField label="Pulls on hand P0" {...numberInput(inputs, actions.setPlannerInput, 'pullsOnHand')} />

              <NumberField label="Income Phase 1 (I1)" {...numberInput(inputs, actions.setPlannerInput, 'incomePhase1')} />
              <NumberField label="Income Phase 2 (I2)" {...numberInput(inputs, actions.setPlannerInput, 'incomePhase2')} />

              <NumberField label="Agent pity (pA)" {...numberInput(inputs, actions.setPlannerInput, 'pityAgentStart')} />
              <CheckboxField label="Agent guaranteed" {...boolInput(inputs, actions.setPlannerInput, 'guaranteedAgentStart')} />

              <NumberField label="W-Engine pity (pW)" {...numberInput(inputs, actions.setPlannerInput, 'pityEngineStart')} />
              <CheckboxField label="W-Engine guaranteed" {...boolInput(inputs, actions.setPlannerInput, 'guaranteedEngineStart')} />

              <NumberField label="q Agent (win rate)" step={0.01} min={0} max={1} {...numberInput(inputs, actions.setPlannerInput, 'qAgent')} />
              <NumberField label="q W-Engine (win rate)" step={0.01} min={0} max={1} {...numberInput(inputs, actions.setPlannerInput, 'qEngine')} />
            </div>

            <div class="text-sm flex gap-2 items-center">
              <button class={`px-3 py-1.5 border rounded-md ${scenario() === 'best' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setScenario('best')}>Best</button>
              <button class={`px-3 py-1.5 border rounded-md ${scenario() === 'expected' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setScenario('expected')}>Expected</button>
              <button class={`px-3 py-1.5 border rounded-md ${scenario() === 'worst' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setScenario('worst')}>Worst</button>
            </div>

          </section>

          <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 space-y-4">
            <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Plan</h2>
            <div class="gap-4 grid">
              <div class="text-sm text-zinc-300 flex items-center justify-between">
                <div>
                  Scenario:
                  {' '}
                  <span class="text-emerald-300">{scenario()}</span>
                </div>
                <div class="flex gap-2">
                  <Badge
                    ok={plan().totals.agentsGot >= selectedTargets().filter(t => t.channel === 'agent').length}
                    label={`${plan().totals.agentsGot} Agents`}
                    title="How many Agents from your selection are affordable across both phases"
                  />
                  <Badge
                    ok={plan().totals.enginesGot >= selectedTargets().filter(t => t.channel === 'engine').length}
                    label={`${plan().totals.enginesGot} Engines`}
                    title="How many W-Engines from your selection are affordable across both phases"
                  />
                  <Badge label={`${plan().totals.pullsLeftEnd} left`} title="Estimated pulls remaining at the end of Phase 2" />
                  <button
                    class="px-3 py-1.5 border border-zinc-700 rounded-md bg-zinc-900 inline-flex gap-2 items-center hover:bg-zinc-800"
                    onClick={onCopy}
                    title="Copy inputs, ordered targets, and plan summary"
                  >
                    <i class={`size-4 ${copied() ? 'i-ph:check-bold' : 'i-ph:clipboard-text-duotone'}`} />
                    Copy
                  </button>
                </div>
              </div>

              <div class="p-3 border border-zinc-700 rounded-lg bg-zinc-900/40 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-emerald-200 font-semibold">Phase 1</div>
                  <div class="flex gap-3 items-center">
                    <div class="text-xs text-zinc-400">
                      Budget:
                      {' '}
                      <span class="text-emerald-300">{phase1Timing() === 'start' ? plan().phase1.startBudget : plan().phase1.endBudget}</span>
                    </div>
                    <div class="text-xs flex gap-1">
                      <button class={`px-2 py-0.5 border rounded ${phase1Timing() === 'start' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setPhase1Timing('start')}>Start</button>
                      <button class={`px-2 py-0.5 border rounded ${phase1Timing() === 'end' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setPhase1Timing('end')}>End</button>
                    </div>
                  </div>
                </div>

                <BudgetBar
                  total={phase1Timing() === 'start' ? plan().phase1.startBudget : plan().phase1.endBudget}
                  segments={[
                    { value: plan().phase1.agentCost, color: 'bg-emerald-600/70', label: 'Agents', title: 'Phase 1 Agents cost' },
                    { value: phase1Timing() === 'start' ? plan().phase1.engineSpendStart : plan().phase1.engineSpendEnd, color: 'bg-sky-600/70', label: 'Engines', title: 'Phase 1 Engines spend this phase' },
                    { value: phase1Timing() === 'start' ? plan().phase1.carryToPhase2Start : plan().phase1.carryToPhase2End, color: 'bg-zinc-700', label: 'Carry', title: 'Pulls carried to Phase 2' },
                  ]}
                />

                <ul class="gap-x-3 gap-y-1 grid" style={{ 'grid-template-columns': '12rem 2rem 8rem auto' }}>
                  <StatRow
                    label="Agents cost"
                    value={plan().phase1.agentCost}
                    badge={{ ok: phase1Timing() === 'start' ? plan().phase1.canAffordAgentStart : plan().phase1.canAffordAgentEnd, label: (phase1Timing() === 'start' ? plan().phase1.canAffordAgentStart : plan().phase1.canAffordAgentEnd) ? 'affordable' : 'not met' }}
                    title="Aggregated cost to secure Phase 1 selected Agents"
                    explain={costExplain(inputs().N, inputs().pityAgentStart, inputs().guaranteedAgentStart, inputs().qAgent)}
                  />
                  <StatRow
                    label="Engines cost"
                    value={plan().phase1.engineCost}
                    badge={{ ok: phase1Timing() === 'start' ? plan().phase1.canAffordEngineStart : plan().phase1.canAffordEngineEnd, label: (phase1Timing() === 'start' ? plan().phase1.canAffordEngineStart : plan().phase1.canAffordEngineEnd) ? 'affordable' : 'not met' }}
                    title="Aggregated cost to secure Phase 1 selected Engines"
                    explain={costExplain(inputs().N, inputs().pityEngineStart, inputs().guaranteedEngineStart, inputs().qEngine)}
                  />
                  <StatRow
                    label="Reserve for Phase 2"
                    value={<span class="text-amber-300">{plan().phase1.reserveForPhase2}</span>}
                    title="Minimum pulls to keep reserved at end of Phase 1 for Phase 2 targets"
                  />
                  <StatRow
                    label="Carry to Phase 2"
                    value={phase1Timing() === 'start' ? plan().phase1.carryToPhase2Start : plan().phase1.carryToPhase2End}
                    badge={{ ok: (phase1Timing() === 'start' ? plan().phase1.carryToPhase2Start : plan().phase1.carryToPhase2End) >= plan().phase1.reserveForPhase2, label: (phase1Timing() === 'start' ? plan().phase1.carryToPhase2Start : plan().phase1.carryToPhase2End) >= plan().phase1.reserveForPhase2 ? 'meets reserve' : 'below reserve' }}
                    title="Estimated pulls remaining after Phase 1"
                  />
                </ul>
              </div>

              <div class="p-3 border border-zinc-700 rounded-lg bg-zinc-900/40 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-emerald-200 font-semibold">Phase 2</div>
                  <div class="flex gap-3 items-center">
                    <div class="text-xs text-zinc-400">
                      Budget:
                      {' '}
                      <span class="text-emerald-300">{phase2Timing() === 'start' ? plan().phase2.startBudget : plan().phase2.endBudget}</span>
                    </div>
                    <div class="text-xs flex gap-1">
                      <button class={`px-2 py-0.5 border rounded ${phase2Timing() === 'start' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setPhase2Timing('start')}>Start</button>
                      <button class={`px-2 py-0.5 border rounded ${phase2Timing() === 'end' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setPhase2Timing('end')}>End</button>
                    </div>
                  </div>
                </div>

                <BudgetBar
                  total={phase2Timing() === 'start' ? plan().phase2.startBudget : plan().phase2.endBudget}
                  segments={[
                    { value: plan().phase2.agentCost, color: 'bg-emerald-600/70', label: 'Agents', title: 'Phase 2 Agents cost' },
                    { value: plan().phase2.engineCost, color: 'bg-sky-600/70', label: 'Engines', title: 'Phase 2 Engines cost' },
                    { value: Math.max(0, (phase2Timing() === 'start' ? plan().phase2.startBudget : plan().phase2.endBudget) - plan().phase2.agentCost - plan().phase2.engineCost), color: 'bg-zinc-700', label: 'Left', title: 'Estimated pulls left after Phase 2' },
                  ]}
                />

                <ul class="gap-x-3 gap-y-1 grid" style={{ 'grid-template-columns': '12rem 2rem 8rem auto' }}>
                  <StatRow
                    label="Agents cost"
                    value={plan().phase2.agentCost}
                    badge={{ ok: phase2Timing() === 'start' ? plan().phase2.canAffordAgentStart : plan().phase2.canAffordAgent, label: (phase2Timing() === 'start' ? plan().phase2.canAffordAgentStart : plan().phase2.canAffordAgent) ? 'affordable' : 'not met' }}
                    title="Aggregated cost to secure Phase 2 selected Agents"
                    explain={costExplain(inputs().N, 0, false, inputs().qAgent)}
                  />
                  <StatRow
                    label="Engines cost"
                    value={plan().phase2.engineCost}
                    badge={{ ok: phase2Timing() === 'start' ? plan().phase2.canAffordEngineAfterAgentStart : plan().phase2.canAffordEngineAfterAgent, label: (phase2Timing() === 'start' ? plan().phase2.canAffordEngineAfterAgentStart : plan().phase2.canAffordEngineAfterAgent) ? 'affordable' : 'not met' }}
                    title="Aggregated cost to secure Phase 2 selected Engines"
                    explain={costExplain(inputs().N, plan().phase2.enginePityStart, false, inputs().qEngine)}
                  />
                </ul>
              </div>

              <div class="p-3 border border-zinc-700 rounded-lg bg-zinc-900/40 space-y-2">
                <div class="text-emerald-200 font-semibold">What this means</div>
                <ul class="text-sm text-zinc-300 space-y-1">
                  <li>
                    You get
                    {' '}
                    <span class="text-emerald-300">{plan().totals.agentsGot}</span>
                    {' '}
                    Agent(s) and
                    {' '}
                    <span class="text-emerald-300">{plan().totals.enginesGot}</span>
                    {' '}
                    W-Engine(s) in this scenario.
                  </li>
                  <Show when={fundedAgents().length}>
                    <li>
                      Funded Agents:
                      {' '}
                      <span class="text-emerald-300">{fundedAgents().join(', ')}</span>
                    </li>
                  </Show>
                  <Show when={fundedEngines().length}>
                    <li>
                      Funded W-Engines:
                      {' '}
                      <span class="text-emerald-300">{fundedEngines().join(', ')}</span>
                    </li>
                  </Show>
                  <Show when={[...missedAgents(), ...missedEngines()].length}>
                    <li>
                      Not funded yet:
                      {' '}
                      <span class="text-red-300">{[...missedAgents(), ...missedEngines()].join(', ')}</span>
                    </li>
                  </Show>
                  <li>
                    End of Phase 2 you have
                    {' '}
                    <span class="text-emerald-300">{plan().totals.pullsLeftEnd}</span>
                    {' '}
                    pulls left.
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
