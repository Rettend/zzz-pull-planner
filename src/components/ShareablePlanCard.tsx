import type { SelectedTargetInput } from '~/lib/plan-view'
import type { PhasePlan, PlannerInputs, Scenario } from '~/lib/planner'
import type { TargetAggregate } from '~/stores/targets'
import { createMemo, For, Show } from 'solid-js'
import { TargetIconCard } from '~/components/TargetIconCard'
import { createFundedMindscapes } from '~/lib/plan-view'

interface ShareablePlanCardProps {
  accountName: string
  showAccountName: boolean
  showProbability: boolean
  showScenario: boolean
  pattern: 'diagonal' | 'dots' | 'plus' | 'none'

  plan: PhasePlan
  inputs: PlannerInputs
  scenario: Scenario
  selectedTargets: SelectedTargetInput[]
  groupedTargets: TargetAggregate[]
}

export function ShareablePlanCard(props: ShareablePlanCardProps) {
  const totals = createMemo(() => props.plan.totals)
  const fundedMindscapes = createMemo(() => createFundedMindscapes(props.plan))

  const totalPulls = createMemo(() => {
    const income = (props.inputs.incomes || []).reduce((a, b) => a + b, 0)
    return props.inputs.pullsOnHand + income
  })

  const securedItems = createMemo(() => {
    const list: { name: string, level: number, channel: 'agent' | 'engine' }[] = []
    const funded = fundedMindscapes()

    for (const t of props.groupedTargets) {
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

    for (const t of props.groupedTargets) {
      const current = funded.get(t.name) ?? -1
      const desired = t.count - 1

      if (current < desired) {
        list.push({ name: t.name, current, desired, channel: t.channel })
      }
    }
    return list
  })

  const overallProbability = createMemo(() => {
    const phases = props.plan.phases
    if (phases.length === 0)
      return 0
    return phases[phases.length - 1].successProbEnd ?? 0
  })

  const scenarioThreshold = createMemo(() => {
    switch (props.scenario) {
      case 'p50': return 0.5
      case 'p60': return 0.6
      case 'p75': return 0.75
      case 'p90': return 0.9
      case 'ev': return 0.5
      default: return 0.5
    }
  })

  const isLowProbability = createMemo(() => overallProbability() < scenarioThreshold())

  const patternBackground = createMemo(() => {
    const color = isLowProbability() ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'

    switch (props.pattern) {
      case 'diagonal':
        return `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8 8l8 8' stroke='${color}' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`
      case 'dots':
        return `url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='8' cy='8' r='1.5' fill='${color}'/%3E%3C/svg%3E")`
      case 'plus':
        return `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 6v8M6 10h8' stroke='${color}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`
      case 'none':
      default:
        return 'none'
    }
  })

  return (
    <div
      id="shareable-plan-card"
      class="text-zinc-100 font-sans p-8 border border-zinc-700 bg-zinc-900 w-[600px] relative overflow-hidden md:w-[800px]"
      style={{
        'background-image': isLowProbability()
          ? 'radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.08) 0%, transparent 50%)'
          : 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.08) 0%, transparent 50%)',
      }}
    >
      {/* Top gradient border */}
      <div
        class="h-0.5 w-full left-0 top-0 absolute"
        style={{
          background: isLowProbability()
            ? 'linear-gradient(90deg, transparent 15%, rgba(239, 68, 68, 0.6) 50%, transparent 85%)'
            : 'linear-gradient(90deg, transparent 15%, rgba(16, 185, 129, 0.6) 50%, transparent 85%)',
        }}
      />

      {/* Corner accents */}
      <div
        class="border-l-2 border-t-2 h-16 w-16 left-0 top-0 absolute"
        classList={{ 'border-emerald-500/40': !isLowProbability(), 'border-red-500/40': isLowProbability() }}
      />
      <div
        class="border-r-2 border-t-2 h-16 w-16 right-0 top-0 absolute"
        classList={{ 'border-emerald-500/40': !isLowProbability(), 'border-red-500/40': isLowProbability() }}
      />
      <div class="border-b-2 border-l-2 border-zinc-600/40 h-16 w-16 bottom-0 left-0 absolute" />
      <div class="border-b-2 border-r-2 border-zinc-600/40 h-16 w-16 bottom-0 right-0 absolute" />

      {/* Background pattern */}
      <Show when={props.pattern !== 'none'}>
        <div
          class="pointer-events-none absolute"
          style={{
            'inset': '12px',
            'background-image': patternBackground(),
            'mask-image': 'linear-gradient(to bottom, transparent 0px, black 8px, black calc(100% - 8px), transparent 100%)',
            '-webkit-mask-image': 'linear-gradient(to bottom, transparent 0px, black 8px, black calc(100% - 8px), transparent 100%)',
          }}
        />
      </Show>

      <div class="relative z-10 space-y-6">
        {/* Header */}
        <div class="pb-4 flex gap-4 items-start justify-between">
          <div class="space-y-2">
            <h1 class="text-2xl text-white tracking-tight font-bold">
              {props.showAccountName ? `${props.accountName}'s Pull Plan` : 'Pull Plan'}
            </h1>
            <Show when={props.showScenario}>
              <div
                class="text-sm font-medium px-1.5 rounded flex h-5 w-fit items-center justify-center"
                classList={{ 'bg-emerald-500/20': !isLowProbability(), 'bg-red-500/20': isLowProbability() }}
              >
                <span classList={{ 'text-emerald-400': !isLowProbability(), 'text-red-400': isLowProbability() }}>{props.scenario}</span>
              </div>
            </Show>
          </div>

          {/* Stats row */}
          <Show when={props.showProbability}>
            <div class="flex gap-4">
              <div class="px-4 py-2 text-center border border-zinc-700/50 rounded-lg bg-zinc-700/30 backdrop-blur-sm">
                <div class="text-xs text-zinc-500 tracking-wide font-medium uppercase">Pulls</div>
                <div class="text-xl text-white font-bold tabular-nums">{Math.round(totalPulls())}</div>
              </div>
              <div class="px-4 py-2 text-center border border-zinc-700/50 rounded-lg bg-zinc-700/30 backdrop-blur-sm">
                <div class="text-xs text-zinc-500 tracking-wide font-medium uppercase">Left</div>
                <div class="text-xl text-white font-bold tabular-nums">{Math.round(totals().pullsLeftEnd)}</div>
              </div>
              <div
                class="px-4 py-2 text-center rounded-lg"
                classList={{
                  'border border-emerald-700/30 bg-emerald-900/30 backdrop-blur-sm': !isLowProbability(),
                  'border border-red-700/30 bg-red-900/30 backdrop-blur-sm': isLowProbability(),
                }}
              >
                <div
                  class="text-xs tracking-wide font-medium uppercase"
                  classList={{ 'text-emerald-500/80': !isLowProbability(), 'text-red-500/80': isLowProbability() }}
                >
                  Success
                </div>
                <div
                  class="text-xl font-bold tabular-nums"
                  classList={{ 'text-emerald-400': !isLowProbability(), 'text-red-400': isLowProbability() }}
                >
                  {(overallProbability() * 100).toFixed(1)}
                  %
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Content Grid */}
        <div class="gap-6 grid grid-cols-1">
          {/* Secured Section */}
          <Show when={securedItems().length > 0}>
            <div
              class="px-8 pb-6 space-y-4 -mx-8 -mb-6"
              style={{ background: 'radial-gradient(circle at 0% 50%, rgba(16, 185, 129, 0.06) 0%, transparent 20%)' }}
            >
              <div class="flex gap-3 items-center">
                <div class="border border-emerald-500/30 rounded bg-emerald-500/20 flex h-7 w-7 items-center justify-center">
                  <i class="i-ph:check-bold text-sm text-emerald-400" />
                </div>
                <h3 class="text-base text-zinc-200 font-semibold">Funded</h3>
                <div
                  class="flex-1 h-px"
                  classList={{ 'bg-zinc-700/50': props.pattern === 'none' }}
                />
                <span class="text-xs text-zinc-500 font-medium">
                  {totals().agentsGot}
                  {' '}
                  Agents,
                  {' '}
                  {totals().enginesGot}
                  {' '}
                  Engines
                </span>
              </div>
              <div class="pl-2 flex flex-wrap gap-4">
                <For each={securedItems()}>
                  {item => (
                    <div class="flex flex-col gap-2 items-center">
                      <div class="origin-top scale-110">
                        <TargetIconCard
                          name={item.name}
                          mindscapeLevel={item.level}
                          selected
                          met={true}
                          channel={item.channel}
                          class="!cursor-default !shadow-black/50 !shadow-lg"
                        />
                      </div>
                      <div class="text-xs text-emerald-300 font-bold px-2 py-0.5 border border-emerald-500/25 rounded bg-emerald-500/15">
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
            <div
              class="px-8 pb-6 space-y-4 -mx-8 -mb-6"
              style={{ background: 'radial-gradient(circle at 0% 50%, rgba(239, 68, 68, 0.06) 0%, transparent 20%)' }}
            >
              <div class="flex gap-3 items-center">
                <div class="border border-red-500/30 rounded bg-red-500/20 flex h-7 w-7 items-center justify-center">
                  <i class="i-ph:x-bold text-sm text-red-400" />
                </div>
                <h3 class="text-base text-zinc-200 font-semibold">Missing</h3>
                <div
                  class="flex-1 h-px"
                  classList={{ 'bg-zinc-700/50': props.pattern === 'none' }}
                />
              </div>
              <div class="pl-2 flex flex-wrap gap-4">
                <For each={missingItems()}>
                  {item => (
                    <div class="flex flex-col gap-2 items-center">
                      <div class="origin-top scale-110">
                        <TargetIconCard
                          name={item.name}
                          mindscapeLevel={item.desired}
                          selected
                          met={false}
                          channel={item.channel}
                          class="!cursor-default !shadow-black/50 !shadow-lg"
                        />
                      </div>
                      <div class="flex flex-wrap gap-1 w-full justify-center">
                        <Show
                          when={item.desired - item.current <= 3}
                          fallback={(
                            <div class="text-xs text-red-300 font-bold px-2 py-0.5 border border-red-500/25 rounded bg-red-500/15">
                              M
                              {item.current + 1}
                              -M
                              {item.desired}
                            </div>
                          )}
                        >
                          <For each={Array.from({ length: item.desired - item.current }, (_, i) => item.current + 1 + i)}>
                            {level => (
                              <div class="text-xs text-red-300 font-bold px-1.5 py-0.5 text-center border border-red-500/25 rounded bg-red-500/15 min-w-[24px]">
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

        {/* Footer */}
        <div
          class="mt-4 pt-4 border-t flex items-center justify-between"
          classList={{
            'border-zinc-700/50': props.pattern === 'none',
            'border-transparent': props.pattern !== 'none',
          }}
        >
          <div class="flex gap-2 items-center">
            <div class="text-sm text-zinc-500 font-medium">
              zzz.rettend.me
            </div>
          </div>
          <div class="text-xs text-zinc-500">
            ZZZ Pull Planner
          </div>
        </div>
      </div>
    </div>
  )
}
