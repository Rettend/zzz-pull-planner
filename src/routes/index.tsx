import type { SelectedTargetInput } from '~/lib/plan-view'
import type { PhasePlan, PlannerInputs } from '~/lib/planner'
import { batch, createMemo, untrack } from 'solid-js'
import { ClientOnly } from '~/components/ClientOnly'
import { Header } from '~/components/Header'
import { AccountsTabs } from '~/components/home/AccountsTabs'
import { PlannerInputsPanel } from '~/components/home/PlannerInputsPanel'
import { PlanOverview } from '~/components/home/PlanOverview'
import { PullSimulationPanel } from '~/components/home/PullSimulationPanel'
import { TargetPicker } from '~/components/TargetPicker'
import { isBannerPast } from '~/lib/constants'
import { computePlan, emptyPlan } from '~/lib/planner'
import { useGame } from '~/stores/game'
import { aggregateTargets, useTargetsStore } from '~/stores/targets'
import { useUIStore } from '~/stores/ui'

export default function Home() {
  const [ui, actions] = useUIStore()
  const [targets, targetActions] = useTargetsStore()
  const game = useGame()
  const inputs = createMemo(() => ui.local.plannerInputs)
  const scenario = createMemo(() => ui.local.scenario)
  const phaseTimings = createMemo(() => ui.local.phaseTimings)

  const activeBanners = createMemo(() => game.banners().filter(b => !isBannerPast(b)))

  const selectedEntries = createMemo(() => (targets?.selected ?? []).slice().sort((a, b) => a.priority - b.priority))

  const filteredEntries = createMemo(() => {
    const mode = ui.local.planningMode
    return selectedEntries().filter((t) => {
      const meta = t.channel === 'agent' ? game.resolveAgent(t.name) : game.resolveWEngine(t.name)
      const rarity = meta?.rarity ?? 5
      return mode === 's-rank' ? rarity === 5 : rarity === 4
    })
  })

  const selectedTargets = createMemo<SelectedTargetInput[]>(() => filteredEntries().map(t => ({ name: t.name, channel: t.channel })))
  const groupedTargets = createMemo(() => aggregateTargets(filteredEntries()))
  const currentEntry = createMemo(() => filteredEntries()[0] ?? null)
  const currentTarget = createMemo<SelectedTargetInput | null>(() => {
    const entry = currentEntry()
    return entry ? { name: entry.name, channel: entry.channel } : null
  })

  const plan = createMemo<PhasePlan>(() => {
    try {
      return computePlan(activeBanners(), inputs(), scenario(), selectedTargets())
    }
    catch {
      return emptyPlan()
    }
  })

  function simulatePull(count: 1 | 10) {
    const targetEntry = untrack(currentEntry)
    if (!targetEntry)
      return
    const currentInputs = untrack(inputs)
    if (currentInputs.pullsOnHand < count)
      return

    const updates: Partial<PlannerInputs> = {
      pullsOnHand: currentInputs.pullsOnHand - count,
    }

    if (targetEntry.channel === 'agent') {
      updates.pityAgentStart = Math.min(89, currentInputs.pityAgentStart + count)
    }
    else {
      updates.pityEngineStart = Math.min(79, currentInputs.pityEngineStart + count)
    }

    actions.setPlannerInputs(updates)
  }

  function onPulledIt() {
    const targetEntry = untrack(currentEntry)
    if (!targetEntry)
      return

    batch(() => {
      if (targetEntry.channel === 'agent') {
        actions.setPlannerInputs({
          pityAgentStart: 0,
          guaranteedAgentStart: false,
        })
      }
      else {
        actions.setPlannerInputs({
          pityEngineStart: 0,
          guaranteedEngineStart: false,
        })
      }
      targetActions.removeEntry(targetEntry.id)
    })
  }

  return (
    <main class="text-emerald-100 font-mono p-6 bg-zinc-900 min-h-screen relative">
      <div class="bg-[linear-gradient(transparent_1px,#18181b_1px),linear-gradient(90deg,transparent_1px,#18181b_1px)] bg-[size:32px_32px] opacity-20 pointer-events-none inset-0 absolute" />
      <Header />
      <div class="mx-auto max-w-7xl relative space-y-6">
        <section class="p-2 border border-zinc-700 rounded-xl bg-zinc-800/50">
          <ClientOnly fallback={<div class="rounded-lg bg-zinc-800/50 h-9 animate-pulse" />}>
            <AccountsTabs />
          </ClientOnly>
        </section>

        <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 space-y-3">
          <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Select Targets</h2>
          <ClientOnly fallback={<div class="rounded-lg bg-zinc-800/50 h-64 animate-pulse" />}>
            <TargetPicker />
          </ClientOnly>
        </section>

        <div class="gap-6 grid lg:grid-cols-[1fr_2fr]">
          <div class="flex flex-col gap-6">
            <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 space-y-4">
              <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Inputs</h2>
              <ClientOnly fallback={<div class="rounded-lg bg-zinc-800/50 h-96 animate-pulse" />}>
                <PlannerInputsPanel />
              </ClientOnly>
            </section>

            <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 h-fit space-y-4">
              <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Pull Simulation</h2>
              <ClientOnly fallback={<div class="rounded-lg bg-zinc-800/50 h-24 animate-pulse" />}>
                <PullSimulationPanel
                  inputs={inputs}
                  currentTarget={currentTarget}
                  onSimulate={simulatePull}
                  onPulled={onPulledIt}
                />
              </ClientOnly>
            </section>
          </div>

          <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 h-full space-y-4">
            <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Plan</h2>
            <ClientOnly fallback={<div class="rounded-lg bg-zinc-800/50 h-96 animate-pulse" />}>
              <PlanOverview
                banners={activeBanners}
                plan={plan}
                inputs={inputs}
                scenario={scenario}
                selectedTargets={selectedTargets}
                groupedTargets={groupedTargets}
                phaseTimings={phaseTimings}
                onPhaseTimingChange={actions.setPhaseTiming}
                planningMode={() => ui.local.planningMode}
              />
            </ClientOnly>
          </section>
        </div>
      </div>
    </main>
  )
}
