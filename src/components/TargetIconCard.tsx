import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { ICON_AGENT_RANK_A, ICON_AGENT_RANK_S, ICON_ITEM_RANK_A, ICON_ITEM_RANK_S, resolveAttributeIcon } from '~/lib/constants'
import { useGame } from '~/stores/game'

const CARD_WIDTH = 100 // px
const MINDSCAPE_PANEL_WIDTH = 30 // px
const CARD_WITH_PANEL_WIDTH = CARD_WIDTH + MINDSCAPE_PANEL_WIDTH // 130px

export const TargetIconCard: Component<{
  name: string
  muted?: boolean
  removable?: boolean
  onRemove?: () => void
  context?: 'selector' | 'selected'
  selected?: boolean
  met?: boolean
  mindscapeLevel?: number
  onIncrementMindscape?: () => void
  onDecrementMindscape?: () => void
  channel?: 'agent' | 'engine'
  showMindscapeControls?: boolean
  class?: string
}> = (props) => {
  const game = useGame()
  const agent = createMemo(() => game.resolveAgent(props.name))
  const wengine = createMemo(() => game.resolveWEngine(props.name))
  const isAgent = createMemo(() => Boolean(agent()))

  const bg = createMemo(() => agent()?.icon ?? wengine()?.icon)
  const attrIcon = createMemo(() => agent() ? resolveAttributeIcon(agent()!.attribute) : undefined)
  const specIcon = createMemo(() => game.resolveSpecialtyIcon((agent() ?? wengine())?.specialty))
  const borderClass = createMemo(() => {
    if (props.met === true)
      return 'border-emerald-500'
    if (props.met === false)
      return 'border-red-500'
    return 'border-zinc-700'
  })
  const cursorClass = createMemo(() => props.context === 'selector' ? 'cursor-pointer' : (props.muted ? 'hover:border-emerald-500/70' : 'cursor-grab'))
  const maxMindscape = createMemo(() => props.channel === 'agent' ? 6 : 5)
  const mindscapeLabel = createMemo(() => {
    if (!props.selected)
      return '-'
    const level = props.mindscapeLevel ?? 0
    return `M${level}`
  })
  const disableIncrement = createMemo(() => props.selected ? (props.mindscapeLevel ?? 0) >= maxMindscape() : false)
  const disableDecrement = createMemo(() => !props.selected)

  const rankIcon = createMemo(() => {
    const meta = agent() ?? wengine()
    const rarity = meta?.rarity ?? 5
    if (isAgent()) {
      return rarity === 5 ? ICON_AGENT_RANK_S : ICON_AGENT_RANK_A
    }
    return rarity === 5 ? ICON_ITEM_RANK_S : ICON_ITEM_RANK_A
  })

  return (
    <div class={`group border-2 ${borderClass()} rounded-xl bg-zinc-800/50 h-100px shadow-sm transition-colors relative ${cursorClass()}  ${props.context === 'selector' && !props.selected ? 'hover:border-emerald-500/70' : ''}  ${props.class ?? ''}`} style={{ width: props.showMindscapeControls ? `${CARD_WITH_PANEL_WIDTH}px` : `${CARD_WIDTH}px` }} title={props.name}>
      <div class="rounded-inherit inset-0 absolute overflow-hidden">
        <div class="h-full inset-0 absolute" style={{ width: props.showMindscapeControls ? `${CARD_WIDTH}px` : '100%' }}>
          <img src={bg() || ''} alt={props.name} class={`h-full w-full inset-0 absolute object-cover ${props.muted ? 'grayscale brightness-75 opacity-80' : ''}`} />

          {/* Rank badge */}
          <img src={rankIcon()} alt="Rank" class="h-6 w-6 left-1 top-1 absolute drop-shadow" />

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

        {/* Mindscape controls panel */}
        <Show when={props.showMindscapeControls}>
          <div class="py-2 border-l border-zinc-700 bg-zinc-900/90 flex flex-col gap-1 h-full items-center right-0 top-0 justify-center absolute backdrop-blur-sm" style={{ width: `${MINDSCAPE_PANEL_WIDTH}px` }}>
            <button
              class="text-emerald-300 px-0.5 py-1.5 rounded flex w-full transition-colors items-center justify-center hover:text-emerald-200 hover:bg-emerald-600/20 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.stopPropagation()
                props.onIncrementMindscape?.()
              }}
              disabled={disableIncrement()}
              title="Increase mindscape"
            >
              <i class="i-ph:plus-bold text-xs" />
            </button>
            <div class="text-xs text-emerald-200 font-bold my-0.5" title={`Mindscape: ${mindscapeLabel()}`}>
              {mindscapeLabel()}
            </div>
            <button
              class="text-emerald-300 px-0.5 py-1.5 rounded flex w-full transition-colors items-center justify-center hover:text-emerald-200 hover:bg-emerald-600/20 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.stopPropagation()
                props.onDecrementMindscape?.()
              }}
              disabled={disableDecrement()}
              title="Decrease mindscape"
            >
              <i class="i-ph:minus-bold text-xs" />
            </button>
          </div>
        </Show>
      </div>

      {/* Remove button */}
      <Show when={props.removable}>
        <button
          class="p-1 border border-zinc-700 rounded-full bg-zinc-900/90 opacity-90 flex size-8 shadow transition-opacity items-center justify-center absolute hover:border-red-500 hover:bg-red-600/80 hover:opacity-100 -right-2 -top-2"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation()
            props.onRemove?.()
          }}
        >
          <i class="i-ph:x-bold text-zinc-200 size-4" />
        </button>
      </Show>
    </div>
  )
}
