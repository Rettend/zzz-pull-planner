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

  plan: PhasePlan
  inputs: PlannerInputs
  scenario: Scenario
  selectedTargets: SelectedTargetInput[]
  groupedTargets: TargetAggregate[]
}

export function ShareablePlanCard(props: ShareablePlanCardProps) {
  const totals = createMemo(() => props.plan.totals)
  const fundedMindscapes = createMemo(() => createFundedMindscapes(props.plan))

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

  return (
    <div
      id="shareable-plan-card"
      class="text-zinc-100 font-sans p-8 bg-zinc-950 w-[800px] relative overflow-hidden"
      style={{
        'background-image': 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, rgba(24, 24, 27, 0) 50%)',
      }}
    >
      {/* Decorative elements */}
      <div class="h-1 w-full left-0 top-0 absolute from-emerald-500/0 to-emerald-500/0 via-emerald-500/50 bg-gradient-to-r" />
      <div class="h-32 w-full pointer-events-none bottom-0 left-0 absolute from-zinc-900/50 to-transparent bg-gradient-to-t" />

      <div class="relative z-10 space-y-8">
        {/* Header */}
        <div class="flex items-start justify-between">
          <div class="space-y-1">
            <h1 class="text-3xl text-white tracking-tight font-bold flex gap-3 items-center">
              <i class="i-ph:strategy-duotone text-emerald-400" />
              {props.showAccountName ? props.accountName : 'Proxy\'s Pull Plan'}
            </h1>
            <Show when={props.showScenario}>
              <div class="text-lg text-emerald-400/80 font-medium flex gap-2 items-center">
                <i class="i-ph:calendar-check-duotone" />
                {props.scenario}
                {' '}
                Scenario
              </div>
            </Show>
          </div>

          {/* High-level stats */}
          <Show when={props.showProbability}>
            <div class="flex gap-6">
              <div class="text-right">
                <div class="text-sm text-zinc-400 tracking-wider font-medium uppercase">Total Pulls</div>
                <div class="text-2xl text-white font-bold">{Math.round(props.inputs.pullsOnHand)}</div>
              </div>
              <div class="text-right">
                <div class="text-sm text-zinc-400 tracking-wider font-medium uppercase">Remaining</div>
                <div class="text-2xl text-emerald-300 font-bold">{Math.round(totals().pullsLeftEnd)}</div>
              </div>
            </div>
          </Show>
        </div>

        {/* Content Grid */}
        <div class="gap-8 grid grid-cols-1">
          {/* Secured Section */}
          <Show when={securedItems().length > 0}>
            <div class="space-y-4">
              <h3 class="text-lg text-emerald-400 font-medium pb-2 border-b border-emerald-900/30 flex gap-2 items-center">
                <i class="i-ph:check-circle-fill" />
                Secured Targets
                <span class="text-sm text-emerald-400/60 font-normal ml-auto">
                  {totals().agentsGot}
                  {' '}
                  Agents,
                  {totals().enginesGot}
                  {' '}
                  Engines
                </span>
              </h3>
              <div class="flex flex-wrap gap-4">
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
                      <div class="text-xs text-emerald-300 font-bold px-2 py-0.5 border border-emerald-500/30 rounded bg-emerald-950/60">
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
            <div class="space-y-4">
              <h3 class="text-lg text-red-400 font-medium pb-2 border-b border-red-900/30 flex gap-2 items-center">
                <i class="i-ph:warning-circle-fill" />
                Missing Targets
              </h3>
              <div class="flex flex-wrap gap-4">
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
                            <div class="text-xs text-red-300 font-bold px-2 py-0.5 border border-red-500/30 rounded bg-red-950/60">
                              M
                              {item.current + 1}
                              -M
                              {item.desired}
                            </div>
                          )}
                        >
                          <For each={Array.from({ length: item.desired - item.current }, (_, i) => item.current + 1 + i)}>
                            {level => (
                              <div class="text-xs text-red-300 font-bold px-1.5 py-0.5 text-center border border-red-500/30 rounded bg-red-950/60 min-w-[24px]">
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
        <div class="mt-4 pt-6 border-t border-zinc-800 flex items-end justify-between">
          <div class="text-sm text-zinc-500">
            zzz.rettend.me
          </div>
        </div>
      </div>
    </div>
  )
}
