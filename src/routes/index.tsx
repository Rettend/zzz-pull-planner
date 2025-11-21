import type { SelectedTargetInput } from '~/lib/plan-view'
import type { PhasePlan, PlannerInputs } from '~/lib/planner'
import { batch, createMemo, untrack } from 'solid-js'
import { ExternalLink } from '~/components/ExternalLink'
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
  const selectedTargets = createMemo<SelectedTargetInput[]>(() => selectedEntries().map(t => ({ name: t.name, channel: t.channel })))
  const groupedTargets = createMemo(() => aggregateTargets(selectedEntries()))
  const currentEntry = createMemo(() => selectedEntries()[0] ?? null)
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
      <div class="mx-auto max-w-7xl relative space-y-6">
        <AccountsTabs />

        <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 space-y-3">
          <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Select Targets</h2>
          <TargetPicker />
        </section>

        <div class="gap-6 grid lg:grid-cols-[1fr_2fr]">
          <PlannerInputsPanel />
          <PlanOverview
            banners={activeBanners}
            plan={plan}
            inputs={inputs}
            scenario={scenario}
            selectedTargets={selectedTargets}
            groupedTargets={groupedTargets}
            phaseTimings={phaseTimings}
            onPhaseTimingChange={actions.setPhaseTiming}
          />
        </div>

        <PullSimulationPanel
          inputs={inputs}
          currentTarget={currentTarget}
          onSimulate={simulatePull}
          onPulled={onPulledIt}
        />
      </div>
      <footer class="text-sm text-zinc-400 mt-12 pt-6 border-t border-zinc-800">
        <div class="mx-auto flex flex-col gap-3 max-w-7xl sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col gap-1 sm:flex-row sm:gap-4 sm:items-center">
            <span class="text-xs text-zinc-500 tracking-[0.2em] uppercase">ZZZ Pull Planner</span>
            <span class="text-zinc-700 hidden sm:inline">|</span>
            <ExternalLink
              href="https://rettend.me"
              class="text-xs text-zinc-500"
            >
              Made by Rettend
            </ExternalLink>
          </div>
          <div class="flex gap-4 items-center">
            <ExternalLink
              href="https://discord.gg/FvVaUPhj3t"
              class="text-zinc-400"
              title="Join Discord"
            >
              <i class="i-ph:discord-logo text-xl" />
            </ExternalLink>
            <ExternalLink
              href="https://github.com/Rettend/zzz-pull-planner"
              class="text-zinc-400"
              title="View the project on GitHub"
            >
              <i class="i-ph:github-logo text-xl" />
            </ExternalLink>
          </div>
        </div>
      </footer>
    </main>
  )
}
