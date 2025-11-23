import type { RoundedBreakdownPart } from '~/lib/plan-view'
import { For } from 'solid-js'
import { StatRow } from '~/components/ui'

interface ChannelCostRowProps {
  label: string
  value: number
  affordable: boolean
  pityLabel: string
  explanation: RoundedBreakdownPart[] | null
  title: string
}

export function ChannelCostRow(props: ChannelCostRowProps) {
  return (
    <StatRow
      label={props.label}
      value={props.value}
      valueOk={props.affordable}
      badge={{ ok: props.affordable, label: props.affordable ? 'affordable' : 'not met' }}
      title={props.title}
      explain={props.explanation
        ? (
            <span>
              <span class="text-zinc-400" title="First S (green) is the p-selected cost to hit the next S. Off-feature reserve (yellow) is extra budget kept for the possibility you lose the 50-50 at this risk level; it is not always spent.">
                {props.pityLabel}
              </span>
              <For each={props.explanation}>
                {part => (
                  <span
                    class={`${part.met ? (part.kind === 'off' ? 'text-amber-300' : (props.label.includes('Engine') ? 'text-sky-300' : 'text-emerald-300')) : 'text-red-300'}`}
                    title={part.kind === 'first' ? 'First S cost at selected risk' : 'Reserve for off-feature at selected risk'}
                  >
                    +
                    {part.value}
                  </span>
                )}
              </For>
            </span>
          )
        : null}
    />
  )
}
