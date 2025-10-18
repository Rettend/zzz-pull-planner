import { createMemo } from 'solid-js'
import { TargetPicker } from '~/components/TargetPicker'
import { Badge, boolInput, BudgetBar, CheckboxField, NumberField, numberInput, StatRow } from '~/components/ui'
import { computeTwoPhasePlan } from '~/lib/planner'
import { useUIStore } from '~/stores/ui'

export default function Home() {
  const [ui, actions] = useUIStore()
  const inputs = () => ui.local.plannerInputs
  const scenario = () => ui.local.scenario
  const phase1Timing = () => ui.local.phase1Timing
  const phase2Timing = () => ui.local.phase2Timing

  const plan = createMemo(() => computeTwoPhasePlan(inputs(), scenario()))

  function formatNumber(n: number): string {
    const rounded = Math.round((n + Number.EPSILON) * 100) / 100
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
  }

  function costExplain(
    N: number,
    pity: number,
    guaranteed: boolean,
    q: number,
  ): string {
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
                  <Badge ok={plan().totals.agentsGot >= 2} label={`${plan().totals.agentsGot} Agents`} title="How many Agents are affordable across both phases" />
                  <Badge ok={plan().totals.enginesGot >= 2} label={`${plan().totals.enginesGot} Engines`} title="How many W-Engines are affordable across both phases" />
                  <Badge label={`${plan().totals.pullsLeftEnd} left`} title="Estimated pulls remaining at the end of Phase 2" />
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
                    { value: plan().phase1.agentCost, color: 'bg-emerald-600/70', label: 'Agent', title: 'Lucia Agent cost' },
                    { value: phase1Timing() === 'start' ? plan().phase1.engineSpendStart : plan().phase1.engineSpendEnd, color: 'bg-sky-600/70', label: 'Engine', title: 'Lucia Engine spend this phase' },
                    { value: phase1Timing() === 'start' ? plan().phase1.carryToPhase2Start : plan().phase1.carryToPhase2End, color: 'bg-zinc-700', label: 'Carry', title: 'Pulls carried to Phase 2' },
                  ]}
                />

                <ul class="gap-x-3 gap-y-1 grid" style={{ 'grid-template-columns': '12rem 2rem 8rem auto' }}>
                  <StatRow
                    label="Agent cost"
                    value={plan().phase1.agentCost}
                    badge={{ ok: phase1Timing() === 'start' ? plan().phase1.canAffordAgentStart : plan().phase1.canAffordAgentEnd, label: (phase1Timing() === 'start' ? plan().phase1.canAffordAgentStart : plan().phase1.canAffordAgentEnd) ? 'affordable' : 'short' }}
                    title="Expected cost to secure the featured Agent in Phase 1"
                    explain={costExplain(inputs().N, inputs().pityAgentStart, inputs().guaranteedAgentStart, inputs().qAgent)}
                  />
                  <StatRow
                    label="W-Engine cost"
                    value={plan().phase1.engineCost}
                    badge={{ ok: phase1Timing() === 'start' ? plan().phase1.canAffordEngineStart : plan().phase1.canAffordEngineEnd, label: (phase1Timing() === 'start' ? plan().phase1.canAffordEngineStart : plan().phase1.canAffordEngineEnd) ? 'affordable' : 'not met' }}
                    title="Expected cost to secure the featured W-Engine in Phase 1"
                    explain={costExplain(inputs().N, inputs().pityEngineStart, inputs().guaranteedEngineStart, inputs().qEngine)}
                  />
                  <StatRow
                    label="Reserve target"
                    value={<span class="text-amber-300">{plan().phase1.reserveForPhase2Agent}</span>}
                    title="Minimum pulls you should keep at end of Phase 1 to fund a fresh Agent in Phase 2 (worst-case)"
                  />
                  <StatRow
                    label="Carry to Phase 2"
                    value={phase1Timing() === 'start' ? plan().phase1.carryToPhase2Start : plan().phase1.carryToPhase2End}
                    badge={{ ok: (phase1Timing() === 'start' ? plan().phase1.carryToPhase2Start : plan().phase1.carryToPhase2End) >= plan().phase1.reserveForPhase2Agent, label: (phase1Timing() === 'start' ? plan().phase1.carryToPhase2Start : plan().phase1.carryToPhase2End) >= plan().phase1.reserveForPhase2Agent ? 'meets reserve' : 'below reserve' }}
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
                    { value: plan().phase2.agentCost, color: 'bg-emerald-600/70', label: 'Agent', title: 'Yidhari Agent cost' },
                    { value: plan().phase2.engineCost, color: 'bg-sky-600/70', label: 'Engine', title: 'Yidhari Engine cost' },
                    { value: Math.max(0, (phase2Timing() === 'start' ? plan().phase2.startBudget : plan().phase2.endBudget) - plan().phase2.agentCost - plan().phase2.engineCost), color: 'bg-zinc-700', label: 'Left', title: 'Estimated pulls left after Phase 2' },
                  ]}
                />

                <ul class="gap-x-3 gap-y-1 grid" style={{ 'grid-template-columns': '12rem 2rem 8rem auto' }}>
                  <StatRow
                    label="Agent cost"
                    value={plan().phase2.agentCost}
                    badge={{ ok: phase2Timing() === 'start' ? plan().phase2.canAffordAgentStart : plan().phase2.canAffordAgent, label: (phase2Timing() === 'start' ? plan().phase2.canAffordAgentStart : plan().phase2.canAffordAgent) ? 'affordable' : 'not met' }}
                    title="Expected cost to secure the featured Agent in Phase 2 (fresh)"
                    explain={costExplain(inputs().N, 0, false, inputs().qAgent)}
                  />
                  <StatRow
                    label="W-Engine cost"
                    value={plan().phase2.engineCost}
                    badge={{ ok: phase2Timing() === 'start' ? plan().phase2.canAffordEngineAfterAgentStart : plan().phase2.canAffordEngineAfterAgent, label: (phase2Timing() === 'start' ? plan().phase2.canAffordEngineAfterAgentStart : plan().phase2.canAffordEngineAfterAgent) ? 'affordable' : 'not met' }}
                    title="Expected cost to secure the featured W-Engine in Phase 2 with current pity (after Agent)"
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
                  <li>
                    End of Phase 2 you have
                    {' '}
                    <span class="text-emerald-300">{plan().totals.pullsLeftEnd}</span>
                    {' '}
                    pulls left.
                  </li>
                  <li class="text-zinc-400">
                    Tip: If reserve is not met at the end of Phase 1, prioritize Agents and delay Engines.
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
