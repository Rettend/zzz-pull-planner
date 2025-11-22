import type { Accessor } from 'solid-js'
import type { Banner } from '~/lib/constants'
import type { SelectedTargetInput } from '~/lib/plan-view'
import type { PhasePlan, PlannerInputs, Scenario } from '~/lib/planner'
import type { TargetAggregate } from '~/stores/targets'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { Badge, BudgetBar, StatRow } from '~/components/ui'
import { formatPlanCopyText } from '~/lib/clipboard'
import { buildPhaseRanges, calculateDisplayedCost, channelBreakdownParts, computeFundingSummary, createFundedMindscapes } from '~/lib/plan-view'
import { useGame } from '~/stores/game'
import { formatSlug } from '~/utils'
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
  const agentFunding = createMemo(() => computeFundingSummary({
    groupedTargets: props.groupedTargets(),
    funded: fundedMindscapes(),
    channel: 'agent',
  }))
  const engineFunding = createMemo(() => computeFundingSummary({
    groupedTargets: props.groupedTargets(),
    funded: fundedMindscapes(),
    channel: 'engine',
  }))

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
    const costs = displayedCosts()
    return props.plan().phases.map((p, i) => ({
      agent: channelBreakdownParts({ ...common, phase: i, channel: 'agent', displayedTotal: costs[i].agent }),
      engine: channelBreakdownParts({ ...common, phase: i, channel: 'engine', displayedTotal: costs[i].engine }),
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

  const missedTargets = createMemo(() => [...agentFunding().missed, ...engineFunding().missed])

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
                    { value: phase.agentCost, color: 'bg-emerald-600/70', label: 'Agents', title: 'Agents cost' },
                    { value: isStart() ? phase.engineSpendStart : phase.engineSpendEnd, color: 'bg-sky-600/70', label: 'Engines', title: 'Engines spend this phase' },
                    { value: isStart() ? phase.carryToNextPhaseStart : phase.carryToNextPhaseEnd, color: 'bg-zinc-700', label: 'Carry', title: 'Pulls carried to next phase' },
                  ]}
                />

                <ul class="gap-x-3 gap-y-1 grid grid-cols-1 md:grid-cols-[12rem_2rem_8rem_auto]">
                  <ChannelCostRow
                    label="Agents cost"
                    value={costs()?.agent ?? 0}
                    affordable={isStart() ? phase.canAffordAgentStart : phase.canAffordAgentEnd}
                    pityLabel={index() === 0 ? `-${Math.max(0, props.inputs().pityAgentStart)}` : ''}
                    explanation={breakdown()?.agent ?? null}
                    title="Aggregated cost to secure selected Agents"
                  />
                  <ChannelCostRow
                    label="Engines cost"
                    value={costs()?.engine ?? 0}
                    affordable={isStart() ? phase.canAffordEngineStart : phase.canAffordEngineEnd}
                    pityLabel={index() === 0 ? `-${Math.max(0, props.inputs().pityEngineStart)}` : ''}
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

        <div class="p-3 border border-zinc-700 rounded-lg bg-zinc-900/40 space-y-2">
          <div class="text-emerald-200 font-semibold">What this means</div>
          <ul class="text-sm text-zinc-300 space-y-1">
            <li>
              You get
              {' '}
              <span class="text-emerald-300">{totals().agentsGot}</span>
              {' '}
              Agent(s) and
              {' '}
              <span class="text-emerald-300">{totals().enginesGot}</span>
              {' '}
              W-Engine(s) in this scenario.
            </li>
            <Show when={agentFunding().funded.length}>
              <li>
                Funded Agents:
                {' '}
                <span class="text-emerald-300">{agentFunding().funded.map(formatSlug).join(', ')}</span>
              </li>
            </Show>
            <Show when={engineFunding().funded.length}>
              <li>
                Funded W-Engines:
                {' '}
                <span class="text-emerald-300">{engineFunding().funded.map(formatSlug).join(', ')}</span>
              </li>
            </Show>
            <Show when={missedTargets().length}>
              <li>
                Not funded yet:
                {' '}
                <span class="text-red-300">{missedTargets().map(formatSlug).join(', ')}</span>
              </li>
            </Show>

            <Show when={estimatedARanks().length > 0}>
              <li class="mt-1 pt-1 border-t border-zinc-700/50">
                <div class="text-xs text-zinc-400 mb-0.5">Estimated A-Ranks:</div>
                <div class="text-purple-300 leading-relaxed">
                  {estimatedARanks().map(x => `+${Math.round(x.count)} ${formatSlug(x.name)}`).join(', ')}
                </div>
              </li>
            </Show>

            <For each={props.plan().phases}>
              {(phase, index) => (
                <Show when={phase.shortfallEnd && (phase.shortfallEnd ?? 0) > 0}>
                  <li>
                    You would need
                    {' '}
                    <span class="text-red-300">{Math.round(phase.shortfallEnd ?? 0)}</span>
                    {' '}
                    more pulls at the end of Phase
                    {' '}
                    {index() + 1}
                    {' '}
                    to fund all selections up to that point.
                  </li>
                </Show>
              )}
            </For>

            <li>
              End of plan you have
              {' '}
              <span class="text-emerald-300">{Math.round(totals().pullsLeftEnd)}</span>
              {' '}
              pulls left.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
