import { createMemo, For } from 'solid-js'
import { boolInput, NumberField, numberInput, sanitizeNumberInput } from '~/components/ui'
import { Button } from '~/components/ui/button'
import { SwitchCard } from '~/components/ui/switch'
import { isBannerPast } from '~/lib/constants'
import { describeLuckMode, describeScenario } from '~/lib/plan-view'
import { computePhaseRanges } from '~/lib/planner'
import { useGame } from '~/stores/game'
import { useProfilesStore } from '~/stores/profiles'

export function PlannerInputsPanel() {
  const [, actions] = useProfilesStore()
  const game = useGame()
  const currentProfile = createMemo(() => actions.currentProfile())
  const settings = createMemo(() => currentProfile().settings)
  const inputs = createMemo(() => settings().plannerInputs)
  const scenario = createMemo(() => settings().scenario)
  const planningMode = createMemo(() => settings().planningMode)
  const luckMode = createMemo(() => inputs().luckMode ?? 'realistic')

  const activeBanners = createMemo(() => game.banners().filter(b => !isBannerPast(b)))
  const ranges = createMemo(() => computePhaseRanges(activeBanners()))

  return (
    <div class="space-y-4">
      <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
        <NumberField label="Pulls on hand" min={0} {...numberInput(inputs, actions.setPlannerInput, 'pullsOnHand', { min: 0 })} />

        <For each={ranges()}>
          {(_, index) => (
            <NumberField
              label="Income"
              label2={`Phase ${index() + 1}`}
              value={String(inputs().incomes?.[index()] ?? 0)}
              onInput={(e) => {
                const v = sanitizeNumberInput(e, { min: 0 })
                const newIncomes = [...(inputs().incomes || [])]
                while (newIncomes.length <= index()) newIncomes.push(0)
                newIncomes[index()] = v
                actions.setPlannerInput('incomes', newIncomes)
              }}
            />
          )}
        </For>
      </div>

      <div class="my-2 bg-zinc-700/50 h-px" />

      <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
        <NumberField
          label="Agent pity"
          min={0}
          max={planningMode() === 's-rank' ? 89 : 9}
          {...numberInput(
            inputs,
            actions.setPlannerInput,
            planningMode() === 's-rank' ? 'pityAgentStart' : 'pityAgentStartA',
            { min: 0, max: planningMode() === 's-rank' ? 89 : 9 },
          )}
        />
        <SwitchCard
          label="Agent guaranteed"
          {...boolInput(
            inputs,
            actions.setPlannerInput,
            planningMode() === 's-rank' ? 'guaranteedAgentStart' : 'guaranteedAgentStartA',
          )}
        />

        <NumberField
          label="W-Engine pity"
          min={0}
          max={planningMode() === 's-rank' ? 79 : 9}
          {...numberInput(
            inputs,
            actions.setPlannerInput,
            planningMode() === 's-rank' ? 'pityEngineStart' : 'pityEngineStartA',
            { min: 0, max: planningMode() === 's-rank' ? 79 : 9 },
          )}
        />
        <SwitchCard
          label="W-Engine guaranteed"
          {...boolInput(
            inputs,
            actions.setPlannerInput,
            planningMode() === 's-rank' ? 'guaranteedEngineStart' : 'guaranteedEngineStartA',
          )}
        />
      </div>

      <div class="my-2 bg-zinc-700/50 h-px" />

      <div class="text-sm mt-6 space-y-3">
        <div class="flex flex-wrap gap-2 items-center">
          <For each={['p50', 'p60', 'p75', 'p90', 'ev'] as const}>
            {value => (
              <Button
                variant={scenario() === value ? 'green' : 'gray'}
                onClick={() => actions.setScenario(value)}
              >
                {value}
              </Button>
            )}
          </For>
        </div>
        <div class="text-xs text-zinc-400 h-8">{describeScenario(scenario())}</div>
        <div class="mt-5 flex flex-wrap gap-2 items-center">
          <For each={['best', 'realistic', 'worst'] as const}>
            {mode => (
              <Button
                variant={luckMode() === mode ? 'green' : 'gray'}
                onClick={() => actions.setPlannerInput('luckMode', mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            )}
          </For>
        </div>
        <div class="text-xs text-zinc-400">{describeLuckMode(luckMode())}</div>
      </div>
    </div>
  )
}
