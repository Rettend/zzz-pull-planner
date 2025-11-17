import type { SelectedTargetInput } from '~/lib/plan-view'
import type { PhasePlan, PlannerInputs } from '~/lib/planner'
import { batch, createMemo, untrack } from 'solid-js'
import { AccountsTabs } from '~/components/home/AccountsTabs'
import { PlannerInputsPanel } from '~/components/home/PlannerInputsPanel'
import { PlanOverview } from '~/components/home/PlanOverview'
import { PullSimulationPanel } from '~/components/home/PullSimulationPanel'
import { TargetPicker } from '~/components/TargetPicker'
import { computeTwoPhasePlan, emptyPlan } from '~/lib/planner'
import { aggregateTargets, useTargetsStore } from '~/stores/targets'
import { useUIStore } from '~/stores/ui'

export default function Home() {
  const [ui, actions] = useUIStore()
  const [targets, targetActions] = useTargetsStore()
  const inputs = createMemo(() => ui.local.plannerInputs)
  const scenario = createMemo(() => ui.local.scenario)
  const phase1Timing = createMemo(() => ui.local.phase1Timing)
  const phase2Timing = createMemo(() => ui.local.phase2Timing)

  const selectedEntries = createMemo(() => (targets?.selected ?? []).slice().sort((a, b) => a.priority - b.priority))
  const selectedTargets = createMemo<SelectedTargetInput[]>(() => selectedEntries().map(t => ({ name: t.name, channel: t.channel })))
  const groupedTargets = createMemo(() => aggregateTargets(selectedEntries()))

  const plan = createMemo<PhasePlan>(() => {
    try {
      return computeTwoPhasePlan(inputs(), scenario(), selectedTargets())
    }
    catch {
      return emptyPlan()
    }
  })

  const currentTarget = createMemo(() => selectedTargets()[0] ?? null)

  function simulatePull(count: 1 | 10) {
    const target = untrack(currentTarget)
    if (!target)
      return
    const currentInputs = untrack(inputs)
    if (currentInputs.pullsOnHand < count)
      return

    const updates: Partial<PlannerInputs> = {
      pullsOnHand: currentInputs.pullsOnHand - count,
    }

    if (target.channel === 'agent') {
      updates.pityAgentStart = Math.min(89, currentInputs.pityAgentStart + count)
    }
    else {
      updates.pityEngineStart = Math.min(79, currentInputs.pityEngineStart + count)
    }

    actions.setPlannerInputs(updates)
  }

  function onPulledIt() {
    const target = untrack(currentTarget)
    if (!target)
      return

    batch(() => {
      if (target.channel === 'agent') {
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
      targetActions.removeEntry(target.name)
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
            plan={plan}
            inputs={inputs}
            scenario={scenario}
            selectedTargets={selectedTargets}
            groupedTargets={groupedTargets}
            phase1Timing={phase1Timing}
            phase2Timing={phase2Timing}
            onPhase1TimingChange={actions.setPhase1Timing}
            onPhase2TimingChange={actions.setPhase2Timing}
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
