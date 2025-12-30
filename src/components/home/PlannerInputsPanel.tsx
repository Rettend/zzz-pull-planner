import { createMemo, For } from 'solid-js'
import { NumberField, sanitizeNumberInput } from '~/components/ui'
import { Button } from '~/components/ui/button'
import { SwitchCard } from '~/components/ui/switch'
import { isBannerPast } from '~/lib/constants'
import { describeLuckMode, describeScenario } from '~/lib/plan-view'
import { computePhaseRanges } from '~/lib/planner'
import { useGame } from '~/stores/game'
import { useProfilesStore } from '~/stores/profiles'
import { defaultPhaseSettings } from '~/types/profile'

export function PlannerInputsPanel() {
  const [, actions] = useProfilesStore()
  const game = useGame()
  const settings = () => actions.currentSettings()
  const phaseSettings = () => actions.currentPhaseSettings()
  const planningMode = createMemo(() => settings().planningMode)

  const activeBanners = createMemo(() => game.banners().filter(b => !isBannerPast(b)))
  const ranges = createMemo(() => computePhaseRanges(activeBanners()))

  return (
    <div class="space-y-4">
      <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
        <NumberField
          label="Pulls on hand"
          min={0}
          value={String(settings().pullsOnHand)}
          onInput={(e) => {
            actions.setSettings({ pullsOnHand: sanitizeNumberInput(e, { min: 0 }) })
          }}
        />

        <For each={ranges()}>
          {(range, index) => {
            const ps = () => phaseSettings()[range] ?? defaultPhaseSettings()
            return (
              <NumberField
                label="Income"
                label2={`Phase ${index() + 1}`}
                value={String(ps().income)}
                onInput={(e) => {
                  const income = sanitizeNumberInput(e, { min: 0 })
                  actions.setPhaseSettings(range, { income })
                }}
              />
            )
          }}
        </For>
      </div>

      <div class="my-2 bg-zinc-700/50 h-px" />

      <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
        {/* S-Rank pity */}
        {planningMode() === 's-rank' && (
          <>
            <NumberField
              label="Agent pity"
              min={0}
              max={89}
              value={String(settings().pityAgentS)}
              onInput={(e) => {
                actions.setSettings({ pityAgentS: sanitizeNumberInput(e, { min: 0, max: 89 }) })
              }}
            />
            <SwitchCard
              label="Agent guaranteed"
              checked={settings().guaranteedAgentS}
              onChange={(checked) => {
                actions.setSettings({ guaranteedAgentS: checked })
              }}
            />

            <NumberField
              label="W-Engine pity"
              min={0}
              max={79}
              value={String(settings().pityEngineS)}
              onInput={(e) => {
                actions.setSettings({ pityEngineS: sanitizeNumberInput(e, { min: 0, max: 79 }) })
              }}
            />
            <SwitchCard
              label="W-Engine guaranteed"
              checked={settings().guaranteedEngineS}
              onChange={(checked) => {
                actions.setSettings({ guaranteedEngineS: checked })
              }}
            />
          </>
        )}

        {/* A-Rank pity */}
        {planningMode() === 'a-rank' && (
          <>
            <NumberField
              label="Agent pity"
              min={0}
              max={9}
              value={String(settings().pityAgentA)}
              onInput={(e) => {
                actions.setSettings({ pityAgentA: sanitizeNumberInput(e, { min: 0, max: 9 }) })
              }}
            />
            <SwitchCard
              label="Agent guaranteed"
              checked={settings().guaranteedAgentA}
              onChange={(checked) => {
                actions.setSettings({ guaranteedAgentA: checked })
              }}
            />

            <NumberField
              label="W-Engine pity"
              min={0}
              max={9}
              value={String(settings().pityEngineA)}
              onInput={(e) => {
                actions.setSettings({ pityEngineA: sanitizeNumberInput(e, { min: 0, max: 9 }) })
              }}
            />
            <SwitchCard
              label="W-Engine guaranteed"
              checked={settings().guaranteedEngineA}
              onChange={(checked) => {
                actions.setSettings({ guaranteedEngineA: checked })
              }}
            />
          </>
        )}
      </div>

      <div class="my-2 bg-zinc-700/50 h-px" />

      <div class="text-sm mt-6 space-y-3">
        <div class="flex flex-wrap gap-2 items-center">
          <For each={['p50', 'p60', 'p75', 'p90', 'ev'] as const}>
            {value => (
              <Button
                variant={settings().scenario === value ? 'green' : 'gray'}
                onClick={() => actions.setScenario(value)}
              >
                {value}
              </Button>
            )}
          </For>
        </div>
        <div class="text-xs text-zinc-400 h-8">{describeScenario(settings().scenario)}</div>
        <div class="mt-5 flex flex-wrap gap-2 items-center">
          <For each={['best', 'realistic', 'worst'] as const}>
            {mode => (
              <Button
                variant={settings().luckMode === mode ? 'green' : 'gray'}
                onClick={() => actions.setSettings({ luckMode: mode })}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            )}
          </For>
        </div>
        <div class="text-xs text-zinc-400">{describeLuckMode(settings().luckMode)}</div>
      </div>
    </div>
  )
}
