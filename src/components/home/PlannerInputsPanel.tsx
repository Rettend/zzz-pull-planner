import { createMemo, For } from 'solid-js'
import { boolInput, CheckboxField, NumberField, numberInput } from '~/components/ui'
import { isBannerPast } from '~/lib/constants'
import { describeLuckMode, describeScenario } from '~/lib/plan-view'
import { computePhaseRanges } from '~/lib/planner'
import { useGame } from '~/stores/game'
import { useUIStore } from '~/stores/ui'

export function PlannerInputsPanel() {
  const [ui, actions] = useUIStore()
  const game = useGame()
  const inputs = createMemo(() => ui.local.plannerInputs)
  const scenario = createMemo(() => ui.local.scenario)
  const luckMode = createMemo(() => ui.local.plannerInputs.luckMode ?? 'realistic')

  const activeBanners = createMemo(() => game.banners().filter(b => !isBannerPast(b)))
  const ranges = createMemo(() => computePhaseRanges(activeBanners()))

  return (
    <div class="space-y-4">
      <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
        <NumberField label="Pulls on hand" min={0} {...numberInput(inputs, actions.setPlannerInput, 'pullsOnHand', { min: 0 })} />
        <span class="hidden sm:block" />

        <For each={ranges()}>
          {(_, index) => (
            <NumberField
              label={`Income Phase ${index() + 1}`}
              value={String(inputs().incomes?.[index()] ?? 0)}
              onInput={(e) => {
                const v = Number(e.currentTarget.value)
                const newIncomes = [...(inputs().incomes || [])]
                while (newIncomes.length <= index()) newIncomes.push(0)
                newIncomes[index()] = Number.isNaN(v) ? 0 : v
                actions.setPlannerInput('incomes', newIncomes)
              }}
            />
          )}
        </For>

        <div class="my-2 bg-zinc-700/50 col-span-1 h-px sm:col-span-2" />

        <NumberField
          label="Agent pity"
          min={0}
          max={ui.local.planningMode === 's-rank' ? 89 : 9}
          {...numberInput(
            inputs,
            actions.setPlannerInput,
            ui.local.planningMode === 's-rank' ? 'pityAgentStart' : 'pityAgentStartA',
            { min: 0, max: ui.local.planningMode === 's-rank' ? 89 : 9 },
          )}
        />
        <CheckboxField
          label="Agent guaranteed"
          {...boolInput(
            inputs,
            actions.setPlannerInput,
            ui.local.planningMode === 's-rank' ? 'guaranteedAgentStart' : 'guaranteedAgentStartA',
          )}
        />

        <NumberField
          label="W-Engine pity"
          min={0}
          max={ui.local.planningMode === 's-rank' ? 79 : 9}
          {...numberInput(
            inputs,
            actions.setPlannerInput,
            ui.local.planningMode === 's-rank' ? 'pityEngineStart' : 'pityEngineStartA',
            { min: 0, max: ui.local.planningMode === 's-rank' ? 79 : 9 },
          )}
        />
        <CheckboxField
          label="W-Engine guaranteed"
          {...boolInput(
            inputs,
            actions.setPlannerInput,
            ui.local.planningMode === 's-rank' ? 'guaranteedEngineStart' : 'guaranteedEngineStartA',
          )}
        />
      </div>

      <div class="my-2 bg-zinc-700/50 col-span-1 h-px sm:col-span-2" />

      <div class="text-sm mt-6 space-y-3">
        <div class="flex flex-wrap gap-2 items-center">
          <For each={['p50', 'p60', 'p75', 'p90', 'ev'] as const}>
            {value => (
              <button
                class={`px-3 py-1.5 border rounded-md ${scenario() === value ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`}
                onClick={() => actions.setScenario(value)}
              >
                {value}
              </button>
            )}
          </For>
        </div>
        <div class="text-xs text-zinc-400 h-8">{describeScenario(scenario())}</div>
        <div class="mt-5 flex flex-wrap gap-2 items-center">
          <For each={['best', 'realistic', 'worst'] as const}>
            {mode => (
              <button
                class={`px-3 py-1.5 border rounded-md ${luckMode() === mode ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`}
                onClick={() => actions.setPlannerInput('luckMode', mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            )}
          </For>
        </div>
        <div class="text-xs text-zinc-400">{describeLuckMode(luckMode())}</div>
      </div>
    </div>
  )
}
