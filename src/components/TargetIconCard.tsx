import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { RANK_S_ICON, resolveAgent, resolveAttributeIcon, resolveSpecialtyIcon, resolveWEngine } from '~/lib/constants'

export const TargetIconCard: Component<{
  name: string
  muted?: boolean
  removable?: boolean
  onRemove?: () => void
  context?: 'selector' | 'selected'
  selected?: boolean
}> = (props) => {
  const agent = createMemo(() => resolveAgent(props.name))
  const wengine = createMemo(() => resolveWEngine(props.name))
  const isAgent = createMemo(() => Boolean(agent()))

  const bg = createMemo(() => agent()?.icon ?? wengine()?.icon)
  const attrIcon = createMemo(() => agent() ? resolveAttributeIcon(agent()!.attribute) : undefined)
  const specIcon = createMemo(() => resolveSpecialtyIcon((agent() ?? wengine())?.specialty))
  const borderClass = createMemo(() => (props.context === 'selector' && props.selected) ? 'border-emerald-500' : 'border-zinc-700')
  const cursorClass = createMemo(() => props.context === 'selector' ? 'cursor-pointer' : (props.muted ? 'hover:border-emerald-500/70' : 'cursor-grab'))

  return (
    <div class={`group border-2 ${borderClass()} rounded-xl bg-zinc-800/50 h-100px w-100px shadow-sm transition-colors relative ${cursorClass()}  ${props.context === 'selector' && !props.selected ? 'hover:border-emerald-500/70' : ''}`} title={props.name}>
      <div class="rounded-inherit inset-0 absolute overflow-hidden">
        <img src={bg() || ''} alt={props.name} class={`h-full w-full inset-0 absolute object-cover ${props.muted ? 'grayscale brightness-75 opacity-80' : ''}`} />

        {/* Rank badge */}
        <img src={RANK_S_ICON} alt="S" class="h-6 w-6 left-1 top-1 absolute drop-shadow" />

        {/* Attribute */}
        <Show when={isAgent() && attrIcon()}>
          <div class="p-0.5 rounded-full bg-zinc-900/90 right-0.5 top-0.5 absolute backdrop-blur-sm">
            <img src={attrIcon()} alt="attr" class="h-6 w-6 drop-shadow" />
          </div>
        </Show>

        {/* Specialty */}
        <Show when={specIcon()}>
          <div class="p-0.5 rounded-full bg-zinc-900/90 bottom-0.5 right-0.5 absolute backdrop-blur-sm">
            <img src={specIcon()!} alt="spec" class="h-6 w-6 drop-shadow" />
          </div>
        </Show>
      </div>

      {/* Remove button */}
      <Show when={props.removable}>
        <button
          class="p-1 border border-zinc-700 rounded-full bg-zinc-900/90 opacity-0 flex size-8 shadow transition-opacity items-center justify-center absolute hover:border-red-500 hover:bg-red-600/80 group-hover:opacity-100 -right-2 -top-2"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation()
            props.onRemove?.()
          }}
        >
          <i class="i-ph-x-bold text-zinc-200 size-4" />
        </button>
      </Show>
    </div>
  )
}
