import type { Accessor } from 'solid-js'
import type { Banner } from '~/lib/constants'
import type { SelectedTargetInput } from '~/lib/plan-view'
import type { PhasePlan, PlannerInputs, Scenario } from '~/lib/planner'
import type { TargetAggregate } from '~/stores/targets'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { Badge, BudgetBar, StatRow } from '~/components/ui'
import { formatPlanCopyText } from '~/lib/clipboard'
import { buildPhaseRanges, calculateDisplayedCost, channelBreakdownParts, createFundedMindscapes } from '~/lib/plan-view'
import { useGame } from '~/stores/game'
import { TargetIconCard } from '../TargetIconCard'
import { ChannelCostRow } from './ChannelCostRow'
import { PhaseHeader } from './PhaseHeader'

interface PlanOverviewProps {
  banners: Accessor<Banner[]>
  plan: Accessor<PhasePlan>
  inputs: Accessor<PlannerInputs>
  scenario: Accessor<Scenario>
  selectedTargets: Accessor<SelectedTargetInput[]>
  groupedTargets: Accessor<TargetAggregate[]>
  phaseTimings: Accessor<Record<number, 'start' | 'end'>>
  onPhaseTimingChange: (index: number, value: 'start' | 'end') => void
  planningMode: Accessor<'s-rank' | 'a-rank'>
}

export function PlanOverview(props: PlanOverviewProps) {
  const [copied, setCopied] = createSignal(false)

  const phaseRanges = createMemo(() => buildPhaseRanges(props.banners()))
  const totals = createMemo(() => props.plan().totals)

  const fundedMindscapes = createMemo(() => createFundedMindscapes(props.plan()))

  const selectedCounts = createMemo(() => {
    const selected = props.selectedTargets()
    return {
      agents: selected.filter(t => t.channel === 'agent').length,
      engines: selected.filter(t => t.channel === 'engine').length,
    }
  })

  const game = useGame()

  const commonParams = createMemo(() => ({
    banners: props.banners(),
    plan: props.plan(),
    scenario: props.scenario(),
    inputs: props.inputs(),
    selectedTargets: props.selectedTargets(),
    ranges: phaseRanges(),
    checkRarity: (name: string) => {
      const agent = game.resolveAgent(name)
      if (agent)
        return agent.rarity
      const engine = game.resolveWEngine(name)
      if (engine)
        return engine.rarity
      return 5
    },
  }))

  const displayedCosts = createMemo(() => {
    const common = commonParams()
    return props.plan().phases.map((p, i) => ({
      agent: calculateDisplayedCost({ ...common, phase: i, channel: 'agent' }),
      engine: calculateDisplayedCost({ ...common, phase: i, channel: 'engine' }),
    }))
  })

  const breakdowns = createMemo(() => {
    const common = commonParams()
    return props.plan().phases.map((p, i) => ({
      agent: channelBreakdownParts({ plan: props.plan(), phase: i, channel: 'agent', inputs: common.inputs, scenario: common.scenario, checkRarity: common.checkRarity }),
      engine: channelBreakdownParts({ plan: props.plan(), phase: i, channel: 'engine', inputs: common.inputs, scenario: common.scenario, checkRarity: common.checkRarity }),
    }))
  })

  const estimatedARanks = createMemo(() => {
    if (props.planningMode() !== 's-rank')
      return []

    const plan = props.plan()
    const totalAgentCost = plan.phases.reduce((acc, p) => acc + p.agentCost, 0)
    const totalEngineCost = plan.phases.reduce((acc, p) => acc + p.engineCost, 0)

    const selected = props.selectedTargets()
    const agents = selected.filter(t => t.channel === 'agent')
    const engines = selected.filter(t => t.channel === 'engine')

    const counts = new Map<string, number>()

    const addCount = (name: string, amount: number) => {
      counts.set(name, (counts.get(name) ?? 0) + amount)
    }

    if (agents.length > 0 && totalAgentCost > 0) {
      const costPerAgent = totalAgentCost / agents.length
      for (const t of agents) {
        const banner = props.banners().find(b => b.featured === t.name)
        if (banner) {
          const numFeatured = banner.featuredARanks.length || 2
          const ratePerSpecific = 0.094 * 0.5 / numFeatured
          const yieldCount = costPerAgent * ratePerSpecific
          for (const a of banner.featuredARanks) {
            addCount(a, yieldCount)
          }
        }
      }
    }

    if (engines.length > 0 && totalEngineCost > 0) {
      const costPerEngine = totalEngineCost / engines.length
      for (const t of engines) {
        const banner = props.banners().find(b => b.featured === t.name)
        if (banner) {
          const numFeatured = banner.featuredARanks.length || 2
          const ratePerSpecific = 0.150 * 0.5 / numFeatured
          const yieldCount = costPerEngine * ratePerSpecific
          for (const a of banner.featuredARanks) {
            addCount(a, yieldCount)
          }
        }
      }
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .filter(x => x.count >= 0.5)
  })

  const securedItems = createMemo(() => {
    const list: { name: string, level: number, channel: 'agent' | 'engine' }[] = []
    const funded = fundedMindscapes()

    for (const t of props.groupedTargets()) {
      if (funded.has(t.name)) {
        const level = funded.get(t.name)!
        if (level >= -1) {
          list.push({ name: t.name, level, channel: t.channel })
        }
      }
    }
    return list
  })

  const missingItems = createMemo(() => {
    const list: { name: string, current: number, desired: number, channel: 'agent' | 'engine' }[] = []
    const funded = fundedMindscapes()

    for (const t of props.groupedTargets()) {
      const current = funded.get(t.name) ?? -1
      const desired = t.count - 1

      if (current < desired) {
        list.push({ name: t.name, current, desired, channel: t.channel })
      }
    }
    return list
  })

  async function onCopy() {
    try {
      const text = formatPlanCopyText(props.inputs(), props.scenario(), props.selectedTargets(), props.plan(), commonParams().checkRarity)
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    catch {
      setCopied(false)
    }
  }

  return (
    <div class="space-y-4">
      <div class="gap-4 grid">
        <div class="text-sm text-zinc-300 flex items-center justify-between">
          <div>
            Scenario:
            {' '}
            <span class="text-emerald-300">{props.scenario()}</span>
          </div>
          <div class="flex flex-wrap gap-2 items-center justify-end">
            <Badge
              ok={props.plan().totals.agentsGot >= selectedCounts().agents}
              label={`${props.plan().totals.agentsGot} Agents`}
              title="How many Agents from your selection are affordable across all phases"
            />
            <Badge
              ok={props.plan().totals.enginesGot >= selectedCounts().engines}
              label={`${props.plan().totals.enginesGot} Engines`}
              title="How many W-Engines from your selection are affordable across all phases"
            />
            <Badge label={`${Math.round(props.plan().totals.pullsLeftEnd)} left`} title="Estimated pulls remaining at the end of the plan" />
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

        <For each={props.plan().phases}>
          {(phase, index) => {
            const timing = createMemo(() => props.phaseTimings()[index()] ?? 'end')
            const isStart = createMemo(() => timing() === 'start')
            const budget = createMemo(() => Math.round(isStart() ? phase.startBudget : phase.endBudget))
            const success = createMemo(() => (isStart() ? (phase.successProbStart ?? 0) : (phase.successProbEnd ?? 0)))

            const costs = createMemo(() => displayedCosts()[index()])
            const breakdown = createMemo(() => breakdowns()[index()])

            const range = phase.id
            const title = createMemo(() => {
              const banner = props.banners().find(b => `${b.start}→${b.end}` === range)
              return banner ? (banner.title || `Phase ${index() + 1}`) : `Phase ${index() + 1}`
            })

            return (
              <div class="p-3 border border-zinc-700 rounded-lg bg-zinc-900/40 space-y-3">
                <PhaseHeader
                  title={title()}
                  budget={budget()}
                  success={success()}
                  timing={timing()}
                  onTimingChange={t => props.onPhaseTimingChange(index(), t)}
                />

                <BudgetBar
                  total={isStart() ? phase.startBudget : phase.endBudget}
                  segments={[
                    ...phase.itemDetails.map(item => ({
                      value: item.cost,
                      color: item.funded
                        ? (item.channel === 'agent' ? 'bg-emerald-600/70' : 'bg-sky-600/70')
                        : 'bg-red-500/60',
                      label: item.channel === 'agent' ? 'Agent' : 'Engine',
                      title: `${item.name} (${item.funded ? 'Funded' : 'Unfunded'})`,
                    })),
                    {
                      value: isStart() ? phase.carryToNextPhaseStart : phase.carryToNextPhaseEnd,
                      color: 'bg-zinc-700',
                      label: 'Carry',
                      title: 'Pulls carried to next phase',
                    },
                  ]}
                />

                <ul class="gap-x-3 gap-y-1 grid grid-cols-1 md:grid-cols-[12rem_2rem_8rem_auto]">
                  <ChannelCostRow
                    label="Agents cost"
                    value={costs()?.agent ?? 0}
                    affordable={isStart() ? phase.canAffordAgentStart : phase.canAffordAgentEnd}
                    pityLabel={index() === 0 ? `-${Math.max(0, props.planningMode() === 's-rank' ? props.inputs().pityAgentStart : (props.inputs().pityAgentStartA ?? 0))}` : ''}
                    explanation={breakdown()?.agent ?? null}
                    title="Aggregated cost to secure selected Agents"
                  />
                  <ChannelCostRow
                    label="Engines cost"
                    value={costs()?.engine ?? 0}
                    affordable={isStart() ? phase.canAffordEngineStart : phase.canAffordEngineEnd}
                    pityLabel={index() === 0 ? `-${Math.max(0, props.planningMode() === 's-rank' ? props.inputs().pityEngineStart : (props.inputs().pityEngineStartA ?? 0))}` : ''}
                    explanation={breakdown()?.engine ?? null}
                    title="Aggregated cost to secure selected Engines"
                  />
                  <StatRow
                    label="Reserve for Next"
                    value={<span class="text-amber-300">{Math.round(phase.reserveForNextPhase)}</span>}
                    title="Minimum pulls to keep reserved at end of this phase for future targets"
                  />
                  <StatRow
                    label="Carry to Next"
                    value={isStart() ? phase.carryToNextPhaseStart : phase.carryToNextPhaseEnd}
                    badge={{
                      ok: (isStart() ? phase.carryToNextPhaseStart : phase.carryToNextPhaseEnd) >= phase.reserveForNextPhase,
                      label: (isStart() ? phase.carryToNextPhaseStart : phase.carryToNextPhaseEnd) >= phase.reserveForNextPhase ? 'meets reserve' : 'below reserve',
                    }}
                    title="Estimated pulls remaining after this phase"
                  />
                </ul>
              </div>
            )
          }}
        </For>

        <div class="space-y-6">
          <div class="flex gap-2 items-center">
            <div class="bg-zinc-800 flex-1 h-px" />
            <span class="text-xs text-zinc-500 tracking-wider font-medium uppercase">Plan Summary</span>
            <div class="bg-zinc-800 flex-1 h-px" />
          </div>

          <div class="gap-6 grid grid-cols-1 lg:grid-cols-2">
            {/* Left Column: Secured & Missing */}
            <div class="space-y-6">
              {/* Secured Section */}
              <Show when={securedItems().length > 0}>
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-emerald-400 font-medium flex gap-2 items-center">
                      <i class="i-ph:check-circle-fill" />
                      Secured
                    </h3>
                    <span class="text-xs text-zinc-500">
                      {totals().agentsGot}
                      {' '}
                      Agents,
                      {' '}
                      {totals().enginesGot}
                      {' '}
                      Engines
                    </span>
                  </div>
                  <div class="gap-3 grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))]">
                    <For each={securedItems()}>
                      {item => (
                        <div class="flex flex-col gap-1 items-center">
                          <TargetIconCard
                            name={item.name}
                            mindscapeLevel={item.level}
                            selected
                            met={true}
                            channel={item.channel}
                            class="!cursor-default"
                          />
                          <div class="text-xs text-emerald-300 font-medium px-2 py-0.5 border border-emerald-900/50 rounded bg-emerald-950/40 shadow-sm">
                            M
                            {item.level}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Missing Section */}
              <Show when={missingItems().length > 0}>
                <div class="flex flex-col gap-3 h-full">
                  <h3 class="text-red-400 font-medium flex gap-2 items-center">
                    <i class="i-ph:warning-circle-fill" />
                    Missing
                  </h3>
                  <div class="gap-3 grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))]">
                    <For each={missingItems()}>
                      {item => (
                        <div class="flex flex-col gap-1 transition-opacity items-center relative">
                          <div class="relative">
                            <TargetIconCard
                              name={item.name}
                              mindscapeLevel={item.desired}
                              selected
                              met={false}
                              channel={item.channel}
                              class="!cursor-default"
                            />
                          </div>
                          <div class="flex flex-wrap gap-1 w-full justify-center">
                            <Show
                              when={item.desired - item.current <= 3}
                              fallback={(
                                <div class="text-xs text-red-300 font-medium px-1.5 py-0.5 text-center border border-red-900/50 rounded bg-red-950/40 shadow-sm">
                                  M
                                  {item.current + 1}
                                  -M
                                  {item.desired}
                                </div>
                              )}
                            >
                              <For each={Array.from({ length: item.desired - item.current }, (_, i) => item.current + 1 + i)}>
                                {level => (
                                  <div class="text-xs text-red-300 font-medium px-1.5 py-0.5 text-center border border-red-900/50 rounded bg-red-950/40 min-w-[24px] shadow-sm">
                                    M
                                    {level}
                                  </div>
                                )}
                              </For>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>

            {/* Right Column: Estimated A-Ranks */}
            <Show when={estimatedARanks().length > 0}>
              <div class="flex flex-col gap-3 h-full">
                <h3 class="text-purple-400 font-medium flex gap-2 items-center">
                  <i class="i-ph:plus-circle-fill" />
                  Estimated A-Ranks
                </h3>
                <div class="border border-zinc-800/50 rounded-xl bg-zinc-900/20 flex-1">
                  <div class="gap-3 grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))]">
                    <For each={estimatedARanks()}>
                      {item => (
                        <div class="flex flex-col gap-1 items-center">
                          <TargetIconCard
                            name={item.name}
                            mindscapeLevel={Math.round(item.count) - 1}
                            selected
                            channel="agent"
                            class="!border-purple-500/60 !cursor-default"
                          />
                          <div class="text-xs text-purple-300 font-medium px-2 py-0.5 border border-purple-900/50 rounded bg-purple-950/40 shadow-sm">
                            ~
                            {Math.round(item.count)}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>
          </div>

          {/* Warnings & Stats */}
          <div class="text-sm pt-4 border-t border-zinc-800/50 gap-2 grid">
            <For each={props.plan().phases}>
              {(phase, index) => (
                <Show when={phase.shortfallEnd && (phase.shortfallEnd ?? 0) > 0}>
                  <div class="text-red-200 p-3 border border-red-900/30 rounded-md bg-red-950/20 flex gap-3 items-start">
                    <i class="i-ph:warning-bold mt-0.5 shrink-0" />
                    <div>
                      Phase
                      {' '}
                      {index() + 1}
                      {' '}
                      Not Met: You need
                      {' '}
                      <span class="text-red-100 font-bold">{Math.round(phase.shortfallEnd ?? 0)}</span>
                      {' '}
                      more pulls to fund everything up to this point.
                    </div>
                  </div>
                </Show>
              )}
            </For>

            <div class="p-3 border border-zinc-800 rounded-md bg-zinc-900/50 flex items-center justify-between">
              <span class="text-zinc-400">Remaining Pulls</span>
              <span class="text-lg text-emerald-300 font-mono">{Math.round(totals().pullsLeftEnd)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
