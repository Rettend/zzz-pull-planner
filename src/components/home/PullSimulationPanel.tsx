import type { Accessor } from 'solid-js'
import type { SelectedTargetInput } from '~/lib/plan-view'
import type { PlannerInputs } from '~/lib/planner'
import { Show } from 'solid-js'
import { useGame } from '~/stores/game'
import { formatSlug } from '~/utils'

interface PullSimulationPanelProps {
  inputs: Accessor<PlannerInputs>
  currentTarget: Accessor<SelectedTargetInput | null>
  onSimulate: (count: 1 | 10) => void
  onPulled: () => void
}

export function PullSimulationPanel(props: PullSimulationPanelProps) {
  const { resolveAgent, resolveWEngine } = useGame()

  const getDisplayName = (target: SelectedTargetInput) => {
    if (target.channel === 'agent') {
      return resolveAgent(target.name)?.name ?? formatSlug(target.name)
    }
    return resolveWEngine(target.name)?.name ?? formatSlug(target.name)
  }

  return (
    <div class="space-y-4">
      <div class="flex gap-2 items-center">
        <button
          class="px-4 py-2 border border-zinc-700 rounded-md bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => props.onSimulate(1)}
          disabled={props.inputs().pullsOnHand < 1 || !props.currentTarget()}
          title="Simulate pulling once toward your highest priority target"
        >
          Pull 1
        </button>
        <button
          class="px-4 py-2 border border-zinc-700 rounded-md bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => props.onSimulate(10)}
          disabled={props.inputs().pullsOnHand < 10 || !props.currentTarget()}
          title="Simulate pulling 10 times toward your highest priority target"
        >
          Pull 10
        </button>
        <button
          class="px-4 py-2 border border-sky-600 rounded-md bg-sky-600/30 hover:bg-sky-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => props.onPulled()}
          disabled={!props.currentTarget()}
          title="Mark the current highest priority target as obtained"
        >
          I Pulled It!
        </button>
      </div>
      <div class="text-xs text-zinc-400">
        <Show
          when={props.currentTarget()}
          fallback="Select a target to enable simulation controls"
        >
          {target => (
            <span>
              Next up:
              {' '}
              {getDisplayName(target())}
              {' '}
              (
              {target().channel === 'agent' ? 'Agent' : 'W-Engine'}
              )
            </span>
          )}
        </Show>
      </div>
    </div>
  )
}
