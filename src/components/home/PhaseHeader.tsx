import { For } from 'solid-js'
import { Badge } from '~/components/ui'

interface PhaseHeaderProps {
  title: string
  budget: number
  success: number
  timing: 'start' | 'end'
  onTimingChange: (value: 'start' | 'end') => void
}

export function PhaseHeader(props: PhaseHeaderProps) {
  return (
    <div class="flex items-center justify-between">
      <div class="text-emerald-200 font-semibold">{props.title}</div>
      <div class="flex gap-3 items-center">
        <div class="text-xs text-zinc-400">
          Budget:
          {' '}
          <span class="text-emerald-300">{props.budget}</span>
        </div>
        <Badge
          ok={props.success >= 0.8}
          label={`${Math.round(props.success * 100)}%`}
          title="Probability that all selected targets fit within the current budget"
        />
        <div class="text-xs flex gap-1">
          <For each={['start', 'end'] as const}>
            {value => (
              <button
                class={`px-2 py-0.5 border rounded ${props.timing === value ? 'bg-emerald-600/30 border-emerald-500' : 'bg-zinc-900 border-zinc-700'}`}
                onClick={() => props.onTimingChange(value)}
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
