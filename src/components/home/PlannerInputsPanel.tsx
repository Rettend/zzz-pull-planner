import { For } from 'solid-js'
import { boolInput, CheckboxField, NumberField, numberInput } from '~/components/ui'
import { describeLuckMode, describeScenario } from '~/lib/plan-view'
import { useUIStore } from '~/stores/ui'

export function PlannerInputsPanel() {
  const [ui, actions] = useUIStore()
  const inputs = () => ui.local.plannerInputs
  const scenario = () => ui.local.scenario
  const luckMode = () => ui.local.plannerInputs.luckMode ?? 'realistic'

  return (
    <section class="p-4 border border-zinc-700 rounded-xl bg-zinc-800/50 space-y-4">
      <h2 class="text-lg text-emerald-300 tracking-wide font-bold">Inputs</h2>
      <div class="gap-3 grid grid-cols-2">
        <NumberField label="Pulls on hand P0" {...numberInput(inputs, actions.setPlannerInput, 'pullsOnHand')} />
        <span />

        <NumberField label="Income Phase 1 (I1)" {...numberInput(inputs, actions.setPlannerInput, 'incomePhase1')} />
        <NumberField label="Income Phase 2 (I2)" {...numberInput(inputs, actions.setPlannerInput, 'incomePhase2')} />

        <NumberField label="Agent pity (pA)" {...numberInput(inputs, actions.setPlannerInput, 'pityAgentStart')} />
        <CheckboxField label="Agent guaranteed" {...boolInput(inputs, actions.setPlannerInput, 'guaranteedAgentStart')} />

        <NumberField label="W-Engine pity (pW)" {...numberInput(inputs, actions.setPlannerInput, 'pityEngineStart')} />
        <CheckboxField label="W-Engine guaranteed" {...boolInput(inputs, actions.setPlannerInput, 'guaranteedEngineStart')} />
      </div>

      <div class="text-sm mt-10 space-y-3">
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
    </section>
  )
}
