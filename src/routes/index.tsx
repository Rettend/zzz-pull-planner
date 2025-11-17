import type { JSX } from 'solid-js'
import type { PhasePlan } from '~/lib/planner'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { TargetPicker } from '~/components/TargetPicker'
import { Badge, boolInput, BudgetBar, CheckboxField, NumberField, numberInput, StatRow } from '~/components/ui'
import { formatPlanCopyText } from '~/lib/clipboard'
import { BANNERS } from '~/lib/constants'
import { computeTwoPhasePlan, emptyPlan } from '~/lib/planner'
import { useAccountsStore } from '~/stores/accounts'
import { aggregateTargets, useTargetsStore } from '~/stores/targets'
import { useUIStore } from '~/stores/ui'
import { computeChannelBreakdown, roundToTarget } from '~/utils/plan'

export default function Home() {
  const [accounts, accountActions] = useAccountsStore()
  const [ui, actions] = useUIStore()
  const [targets, targetActions] = useTargetsStore()
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editingValue, setEditingValue] = createSignal('')
  const inputs = createMemo(() => ui.local.plannerInputs)
  const scenario = createMemo(() => ui.local.scenario)
  const phase1Timing = createMemo(() => ui.local.phase1Timing)
  const phase2Timing = createMemo(() => ui.local.phase2Timing)
  const luckMode = createMemo(() => ui.local.plannerInputs.luckMode ?? 'realistic')

  const selectedEntries = createMemo(() => (targets?.selected ?? []).slice().sort((a, b) => a.priority - b.priority))
  const selectedTargets = () => selectedEntries().map(t => ({ name: t.name, channel: t.channel }))
  const groupedTargets = createMemo(() => aggregateTargets(selectedEntries()))

  const orderedTargets = selectedEntries
  const currentTarget = createMemo(() => orderedTargets()[0] ?? null)

  const plan = createMemo<PhasePlan>(() => {
    try {
      return computeTwoPhasePlan(inputs(), scenario(), selectedTargets())
    }
    catch {
      return emptyPlan()
    }
  })

  const fundedMindscapes = createMemo(() => {
    const funded = plan().fundedTargets
    const result = new Map<string, number>()

    for (const name of funded) {
      const current = result.get(name) ?? -1
      result.set(name, current + 1)
    }

    return result
  })

  const fundedAgents = createMemo(() => {
    const funded = fundedMindscapes()
    return groupedTargets()
      .filter(t => t.channel === 'agent' && funded.has(t.name))
      .map((t) => {
        const maxFunded = funded.get(t.name) ?? 0
        if (maxFunded === 0)
          return t.name
        return `${t.name} M${maxFunded}`
      })
  })

  const missedAgents = createMemo(() => {
    const funded = fundedMindscapes()
    return groupedTargets()
      .filter((t) => {
        const desiredMax = t.count - 1
        const fundedMax = funded.get(t.name) ?? -1
        return t.channel === 'agent' && desiredMax >= 0 && fundedMax < desiredMax
      })
      .map((t) => {
        const maxFunded = funded.get(t.name) ?? -1
        const desiredMax = t.count - 1
        if (maxFunded < 0)
          return t.name
        if (desiredMax === 0)
          return t.name
        const start = Math.max(0, maxFunded + 1)
        if (start > desiredMax)
          return t.name
        return `${t.name} M${start}-M${desiredMax}`
      })
  })

  const fundedEngines = createMemo(() => {
    const funded = fundedMindscapes()
    return groupedTargets()
      .filter(t => t.channel === 'engine' && funded.has(t.name))
      .map((t) => {
        const maxFunded = funded.get(t.name) ?? 0
        if (maxFunded === 0)
          return t.name
        return `${t.name} M${maxFunded}`
      })
  })

  const missedEngines = createMemo(() => {
    const funded = fundedMindscapes()
    return groupedTargets()
      .filter((t) => {
        const desiredMax = t.count - 1
        const fundedMax = funded.get(t.name) ?? -1
        return desiredMax >= 0 && fundedMax < desiredMax && t.channel === 'engine'
      })
      .map((t) => {
        const maxFunded = funded.get(t.name) ?? -1
        const desiredMax = t.count - 1
        if (maxFunded < 0)
          return t.name
        if (desiredMax === 0)
          return t.name
        const start = Math.max(0, maxFunded + 1)
        if (start > desiredMax)
          return t.name
        return `${t.name} M${start}-M${desiredMax}`
      })
  })

  const [copied, setCopied] = createSignal(false)

  function onAddAccount() {
    accountActions.add()
  }

  function startEditAccount(id: string, name: string) {
    setEditingId(id)
    setEditingValue(name)
  }

  function submitEditAccount() {
    const id = editingId()
    if (!id)
      return
    const name = editingValue().trim()
    if (name.length === 0)
      accountActions.remove(id)
    else
      accountActions.rename(id, name)
    setEditingId(null)
  }

  function rangeKey(b: { start: string, end: string }) {
    return `${b.start}→${b.end}`
  }
  const ranges = createMemo(() => Array.from(new Set(BANNERS.map(b => rangeKey(b)))).sort((a, b) => a.localeCompare(b)))
  function phaseOfName(name: string): 1 | 2 {
    const b = BANNERS.find(x => x.featured === name)
    if (!b)
      return 1
    const idx = ranges().indexOf(rangeKey(b))
    return (idx <= 0 ? 1 : 2)
  }
  function namesForPhaseChannel(phase: 1 | 2, channel: 'agent' | 'engine'): string[] {
    return selectedTargets().filter(t => (phaseOfName(t.name) === phase) && t.channel === channel).map(t => t.name)
  }

  function planCost(phase: 1 | 2, channel: 'agent' | 'engine'): number {
    if (phase === 1)
      return channel === 'agent' ? plan().phase1.agentCost : plan().phase1.engineCost
    return channel === 'agent' ? plan().phase2.agentCost : plan().phase2.engineCost
  }

  function displayedCost(phase: 1 | 2, channel: 'agent' | 'engine'): number {
    const actual = Math.round(planCost(phase, channel))
    if (actual > 0)
      return actual
    const br = computeChannelBreakdown(phase, channel, plan(), scenario(), inputs(), namesForPhaseChannel(phase, channel))
    if (!br)
      return 0
    const raw = br.parts.map(p => p.value)
    return Math.round(raw.reduce((a, b) => a + b, 0))
  }

  function renderExplainForPhaseChannel(
    phase: 1 | 2,
    channel: 'agent' | 'engine',
    displayedTotal: number,
    pityLabel: string,
    notMet: boolean,
  ): JSX.Element | null {
    const breakdown = computeChannelBreakdown(phase, channel, plan(), scenario(), inputs(), namesForPhaseChannel(phase, channel))
    if (!breakdown)
      return null
    const rawValues = breakdown.parts.map(p => p.value)
    const sumRaw = Math.round(rawValues.reduce((a, b) => a + b, 0))
    const rounded = roundToTarget(rawValues, displayedTotal > 0 ? displayedTotal : sumRaw)
    return (
      <span>
        <span class="text-zinc-400" title="First S (green) is the p-selected cost to hit the next S. Off-feature reserve (yellow) is extra budget kept for the possibility you lose the 50-50 at this risk level; it is not always spent.">{pityLabel}</span>
        <For each={rounded}>
          {(v, i) => (
            <span class={notMet ? 'text-red-300' : (breakdown.parts[i()].kind === 'first' ? 'text-emerald-300' : 'text-amber-300')} title={breakdown.parts[i()].kind === 'first' ? 'First S cost at selected risk' : 'Reserve for off-feature at selected risk'}>
              +
              {v}
            </span>
          )}
        </For>
      </span>
    )
  }

  function formatCopyText(): string {
    return formatPlanCopyText(inputs(), scenario(), selectedTargets(), plan())
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

  function simulatePull(count: 1 | 10) {
    const target = currentTarget()
    if (!target)
      return
    const currentPulls = inputs().pullsOnHand
    if (currentPulls < count) {
      return
    }
    actions.setPlannerInput('pullsOnHand', currentPulls - count)

    if (target.channel === 'agent') {
      const currentPity = inputs().pityAgentStart
      const newPity = Math.min(89, currentPity + count)
      actions.setPlannerInput('pityAgentStart', newPity)
    }
    else {
      const currentPity = inputs().pityEngineStart
      const newPity = Math.min(79, currentPity + count)
      actions.setPlannerInput('pityEngineStart', newPity)
    }
  }

  function onPulledIt() {
    const target = currentTarget()
    if (!target)
      return

    if (target.channel === 'agent') {
      actions.setPlannerInput('pityAgentStart', 0)
      actions.setPlannerInput('guaranteedAgentStart', false)
    }
    else {
      actions.setPlannerInput('pityEngineStart', 0)
      actions.setPlannerInput('guaranteedEngineStart', false)
    }

    targetActions.removeEntry(target.id)
  }

  return (
    <main class="text-emerald-100 font-mono p-6 bg-zinc-900 min-h-screen relative">
      <div class="bg-[linear-gradient(transparent_1px,#18181b_1px),linear-gradient(90deg,transparent_1px,#18181b_1px)] bg-[size:32px_32px] opacity-20 pointer-events-none inset-0 absolute" />
      <div class="mx-auto max-w-7xl relative space-y-6">
        {/* Accounts Tabs */}
        <section class="p-2 border border-zinc-700 rounded-xl bg-zinc-800/50">
          <div class="flex gap-2 items-center overflow-x-auto">
            <For each={accounts.accounts}>
              {acc => (
                <Show
                  when={editingId() === acc.id}
                  fallback={(
                    <button
                      class={`group px-2 py-1 border rounded-md inline-flex gap-2 w-32 items-start ${accounts.currentId === acc.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-emerald-500/60'}`}
                      onClick={() => accountActions.select(acc.id)}
                      title={acc.name}
                    >
                      <span class={`${accounts.currentId === acc.id ? 'text-emerald-200' : 'text-zinc-200'} w-28 truncate`}>{acc.name}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        class="text-zinc-300 ml-auto opacity-0 cursor-pointer transition-opacity hover:text-emerald-300 group-hover:opacity-100"
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditAccount(acc.id, acc.name)
                        }}
                        onKeyDown={(e) => {
                          const k = e.key
                          if (k === 'Enter' || k === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            startEditAccount(acc.id, acc.name)
                          }
                        }}
                      >
                        <i class="i-ph:pencil-simple-duotone" />
                      </span>
                    </button>
                  )}
                >
                  <div
                    class={`px-2 py-1 border rounded-md inline-flex gap-2 w-32 items-start ${accounts.currentId === acc.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-zinc-900 border-zinc-700 text-zinc-300'}`}
                    title={acc.name}
                  >
                    <input
                      class={`outline-none bg-transparent ${accounts.currentId === acc.id ? 'text-emerald-200' : 'text-zinc-200'}`}
                      value={editingValue()}
                      ref={(el) => {
                        setTimeout(() => {
                          el?.focus()
                          el?.select()
                        }, 0)
                      }}
                      onInput={e => setEditingValue(e.currentTarget.value)}
                      onBlur={() => submitEditAccount()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          submitEditAccount()
                        }
                      }}
                    />
                  </div>
                </Show>
              )}
            </For>
            <button
              class="text-zinc-200 px-2 py-1 border border-zinc-700 rounded-md bg-zinc-900 hover:border-emerald-500/60"
              onClick={onAddAccount}
              title="Add account"
            >
              <i class="i-ph:plus-bold" />
            </button>
          </div>
        </section>

        {/* Full-width selector panel */}
        <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 space-y-3">
          <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Select Targets</h2>
          <TargetPicker />
        </section>

        <div class="gap-6 grid lg:grid-cols-[1fr_2fr]">
          <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 space-y-4">
            <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Inputs</h2>
            <div class="gap-3 grid grid-cols-2">
              <NumberField label="Pulls on hand P0" {...numberInput(inputs, actions.setPlannerInput, 'pullsOnHand')} />
              <span />

              <NumberField label="Income Phase 1 (I1)" {...numberInput(inputs, actions.setPlannerInput, 'incomePhase1')} />
              <NumberField label="Income Phase 2 (I2)" {...numberInput(inputs, actions.setPlannerInput, 'incomePhase2')} />

              <NumberField label="Agent pity (pA)" {...numberInput(inputs, actions.setPlannerInput, 'pityAgentStart')} />
              <CheckboxField label="Agent guaranteed" {...boolInput(inputs, actions.setPlannerInput, 'guaranteedAgentStart')} />

              <NumberField label="W-Engine pity (pW)" {...numberInput(inputs, actions.setPlannerInput, 'pityEngineStart')} />
              <CheckboxField label="W-Engine guaranteed" {...boolInput(inputs, actions.setPlannerInput, 'guaranteedEngineStart')} />
            </div>

            <div class="text-sm mt-10 space-y-3">
              <div class="flex flex-wrap gap-2 items-center">
                <button class={`px-3 py-1.5 border rounded-md ${scenario() === 'p50' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setScenario('p50')}>p50</button>
                <button class={`px-3 py-1.5 border rounded-md ${scenario() === 'p60' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setScenario('p60')}>p60</button>
                <button class={`px-3 py-1.5 border rounded-md ${scenario() === 'p75' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setScenario('p75')}>p75</button>
                <button class={`px-3 py-1.5 border rounded-md ${scenario() === 'p90' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setScenario('p90')}>p90</button>
                <button class={`px-3 py-1.5 border rounded-md ${scenario() === 'ev' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setScenario('ev')}>EV</button>
              </div>
              <div class="text-xs text-zinc-400 h-8">
                {(() => {
                  const s = scenario()
                  if (s === 'p50')
                    return 'Risk: p50 is the median — half the time you\'ll spend more, half less.'
                  if (s === 'p60')
                    return 'Risk: p60 adds a small buffer over median; a realistic default for many players.'
                  if (s === 'p75')
                    return 'Risk: p75 is a safe buffer; good if you want fewer surprises.'
                  if (s === 'p90')
                    return 'Risk: p90 is very safe; plan for the unlucky case.'
                  if (s === 'ev')
                    return 'EV: long-run average cost; useful benchmark, not a safety floor.'
                  return 'Choose a risk level: higher p means a larger safety buffer.'
                })()}
              </div>
              <div class="mt-5 flex flex-wrap gap-2 items-center">
                <button class={`px-3 py-1.5 border rounded-md ${luckMode() === 'best' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setPlannerInput('luckMode', 'best')}>Best</button>
                <button class={`px-3 py-1.5 border rounded-md ${luckMode() === 'realistic' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setPlannerInput('luckMode', 'realistic')}>Realistic</button>
                <button class={`px-3 py-1.5 border rounded-md ${luckMode() === 'worst' ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`} onClick={() => actions.setPlannerInput('luckMode', 'worst')}>Worst</button>
              </div>
              <div class="text-xs text-zinc-400">
                {(() => {
                  const m = luckMode()
                  if (m === 'best')
                    return 'Featured odds: q=1.0. Plan as if you always win the 50/50 or 75/25.'
                  if (m === 'worst')
                    return 'Featured odds: q=0.0. Plan as if you always lose the 50/50 or 75/25.'
                  return 'Featured odds: q=0.5 (Agents) / q=0.75 (W-Engines).'
                })()}
              </div>
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
                  <Badge label={`${Math.round(plan().totals.pullsLeftEnd)} left`} title="Estimated pulls remaining at the end of Phase 2" />
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
                      <span class="text-emerald-300">{Math.round(phase1Timing() === 'start' ? plan().phase1.startBudget : plan().phase1.endBudget)}</span>
                    </div>
                    <Badge
                      ok={(phase1Timing() === 'start' ? (plan().phase1.successProbStart ?? 0) : (plan().phase1.successProbEnd ?? 0)) >= 0.8}
                      label={`${Math.round(((phase1Timing() === 'start' ? (plan().phase1.successProbStart ?? 0) : (plan().phase1.successProbEnd ?? 0)) * 100))}%`}
                      title="Probability that all Phase 1 selected targets fit within the current budget"
                    />
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
                    value={displayedCost(1, 'agent')}
                    valueOk={phase1Timing() === 'start' ? plan().phase1.canAffordAgentStart : plan().phase1.canAffordAgentEnd}
                    badge={{ ok: phase1Timing() === 'start' ? plan().phase1.canAffordAgentStart : plan().phase1.canAffordAgentEnd, label: (phase1Timing() === 'start' ? plan().phase1.canAffordAgentStart : plan().phase1.canAffordAgentEnd) ? 'affordable' : 'not met' }}
                    title="Aggregated cost to secure Phase 1 selected Agents"
                    explain={renderExplainForPhaseChannel(1, 'agent', displayedCost(1, 'agent'), `-${Math.max(0, inputs().pityAgentStart)}`, !(phase1Timing() === 'start' ? plan().phase1.canAffordAgentStart : plan().phase1.canAffordAgentEnd))}
                  />
                  <StatRow
                    label="Engines cost"
                    value={displayedCost(1, 'engine')}
                    valueOk={phase1Timing() === 'start' ? plan().phase1.canAffordEngineStart : plan().phase1.canAffordEngineEnd}
                    badge={{ ok: phase1Timing() === 'start' ? plan().phase1.canAffordEngineStart : plan().phase1.canAffordEngineEnd, label: (phase1Timing() === 'start' ? plan().phase1.canAffordEngineStart : plan().phase1.canAffordEngineEnd) ? 'affordable' : 'not met' }}
                    title="Aggregated cost to secure Phase 1 selected Engines"
                    explain={renderExplainForPhaseChannel(1, 'engine', displayedCost(1, 'engine'), `-${Math.max(0, inputs().pityEngineStart)}`, !(phase1Timing() === 'start' ? plan().phase1.canAffordEngineStart : plan().phase1.canAffordEngineEnd))}
                  />
                  <StatRow
                    label="Reserve for Phase 2"
                    value={<span class="text-amber-300">{Math.round(plan().phase1.reserveForPhase2)}</span>}
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
                      <span class="text-emerald-300">{Math.round(phase2Timing() === 'start' ? plan().phase2.startBudget : plan().phase2.endBudget)}</span>
                    </div>
                    <Badge
                      ok={(phase2Timing() === 'start' ? (plan().phase2.successProbStart ?? 0) : (plan().phase2.successProbEnd ?? 0)) >= 0.8}
                      label={`${Math.round(((phase2Timing() === 'start' ? (plan().phase2.successProbStart ?? 0) : (plan().phase2.successProbEnd ?? 0)) * 100))}%`}
                      title="Probability that all Phase 2 selected targets fit within the current budget"
                    />
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
                    value={displayedCost(2, 'agent')}
                    valueOk={phase2Timing() === 'start' ? plan().phase2.canAffordAgentStart : plan().phase2.canAffordAgent}
                    badge={{ ok: phase2Timing() === 'start' ? plan().phase2.canAffordAgentStart : plan().phase2.canAffordAgent, label: (phase2Timing() === 'start' ? plan().phase2.canAffordAgentStart : plan().phase2.canAffordAgent) ? 'affordable' : 'not met' }}
                    title="Aggregated cost to secure Phase 2 selected Agents"
                    explain={renderExplainForPhaseChannel(2, 'agent', displayedCost(2, 'agent'), `-0`, !(phase2Timing() === 'start' ? plan().phase2.canAffordAgentStart : plan().phase2.canAffordAgent))}
                  />
                  <StatRow
                    label="Engines cost"
                    value={displayedCost(2, 'engine')}
                    valueOk={phase2Timing() === 'start' ? plan().phase2.canAffordEngineAfterAgentStart : plan().phase2.canAffordEngineAfterAgent}
                    badge={{ ok: phase2Timing() === 'start' ? plan().phase2.canAffordEngineAfterAgentStart : plan().phase2.canAffordEngineAfterAgent, label: (phase2Timing() === 'start' ? plan().phase2.canAffordEngineAfterAgentStart : plan().phase2.canAffordEngineAfterAgent) ? 'affordable' : 'not met' }}
                    title="Aggregated cost to secure Phase 2 selected Engines"
                    explain={renderExplainForPhaseChannel(2, 'engine', displayedCost(2, 'engine'), `-${Math.max(0, plan().phase2.enginePityStart)}`, !(phase2Timing() === 'start' ? plan().phase2.canAffordEngineAfterAgentStart : plan().phase2.canAffordEngineAfterAgent))}
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
                  <Show when={plan().phase1.shortfallEnd && (plan().phase1.shortfallEnd ?? 0) > 0}>
                    <li>
                      You would need
                      {' '}
                      <span class="text-red-300">{Math.round(plan().phase1.shortfallEnd ?? 0)}</span>
                      {' '}
                      more pulls at the end of Phase 1 to fund all Phase 1 selections.
                    </li>
                  </Show>
                  <Show when={plan().phase2.shortfallEnd && (plan().phase2.shortfallEnd ?? 0) > 0}>
                    <li>
                      You would need
                      {' '}
                      <span class="text-red-300">{Math.round(plan().phase2.shortfallEnd ?? 0)}</span>
                      {' '}
                      more pulls at the end of Phase 2 to get everything.
                    </li>
                  </Show>
                  <li>
                    End of Phase 2 you have
                    {' '}
                    <span class="text-emerald-300">{Math.round(plan().totals.pullsLeftEnd)}</span>
                    {' '}
                    pulls left.
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 h-fit space-y-4">
          <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Pull Simulation</h2>
          <div class="flex gap-2 items-center">
            <button
              class="px-4 py-2 border border-zinc-700 rounded-md bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => simulatePull(1)}
              disabled={inputs().pullsOnHand < 1 || !currentTarget()}
              title="Simulate pulling once toward your highest priority target"
            >
              Pull 1
            </button>
            <button
              class="px-4 py-2 border border-zinc-700 rounded-md bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => simulatePull(10)}
              disabled={inputs().pullsOnHand < 10 || !currentTarget()}
              title="Simulate pulling 10 times toward your highest priority target"
            >
              Pull 10
            </button>
            <button
              class="px-4 py-2 border border-amber-700 rounded-md bg-amber-900/30 hover:bg-amber-800/40 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onPulledIt}
              disabled={!currentTarget()}
              title="Mark the current highest priority target as obtained"
            >
              I Pulled It!
            </button>
          </div>
          <div class="text-xs text-zinc-400">
            {(() => {
              const target = currentTarget()
              if (!target)
                return 'Select a target to enable simulation controls'
              const channelLabel = target.channel === 'agent' ? 'Agent' : 'W-Engine'
              return `Next up: ${target.name} (${channelLabel})`
            })()}
          </div>
        </section>
      </div>
      <footer class="text-sm text-zinc-400 mt-12 pt-6 border-t border-zinc-800">
        <div class="mx-auto flex flex-col gap-3 max-w-7xl sm:flex-row sm:items-center sm:justify-between">
          <span class="text-xs text-zinc-500 tracking-[0.2em] uppercase">ZZZ Pull Planner</span>
          <a
            href="https://github.com/Rettend/zzz-pull-planner"
            target="_blank"
            rel="noopener noreferrer"
            class="text-zinc-300 inline-flex gap-2 items-center hover:text-emerald-300"
            title="View the project on GitHub"
          >
            <i class="i-ph:github-logo text-xl" />
            <span>Source on GitHub</span>
          </a>
        </div>
      </footer>
    </main>
  )
}
