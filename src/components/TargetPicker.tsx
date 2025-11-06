import type { Component } from 'solid-js'
import type { ChannelType } from '~/lib/constants'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { BANNERS, isBannerPast } from '~/lib/constants'
import { computeTwoPhasePlan, emptyPlan } from '~/lib/planner'
import { useTargetsStore } from '~/stores/targets'
import { useUIStore } from '~/stores/ui'
import { TargetIconCard } from './TargetIconCard'

export const TargetPicker: Component = () => {
  const [targets, actions] = useTargetsStore()
  const [ui] = useUIStore()

  const inputs = () => ui.local.plannerInputs
  const scenario = () => ui.local.scenario

  const ranges = createMemo(() => [...new Set(BANNERS.filter(b => !isBannerPast(b)).map(b => `${b.start} → ${b.end}`))])
  const selectedSorted = createMemo(() => [...targets.selected].sort((a, b) => a.priority - b.priority))
  // Expand selected targets into duplicates based on mindscape count
  const selectedTargetsInput = createMemo(() => {
    const result: Array<{ name: string, channel: ChannelType }> = []
    for (const t of selectedSorted()) {
      const count = t.mindscapeCount + 1 // +1 because M0 = 1 pull, M1 = 2 pulls, etc.
      for (let i = 0; i < count; i++) {
        result.push({ name: t.name, channel: t.channel })
      }
    }
    return result
  })
  const plan = createMemo(() => {
    try {
      return computeTwoPhasePlan(inputs(), scenario(), selectedTargetsInput())
    }
    catch {
      return emptyPlan()
    }
  })
  const fundedSet = createMemo(() => new Set(plan().fundedTargets))
  const isSelected = (name: string) => targets.selected.some(s => s.name === name)

  const [dragIndex, setDragIndex] = createSignal<number | null>(null)
  const [insertIndex, setInsertIndex] = createSignal<number | null>(null)
  const DRAG_HYSTERESIS_PX = 12

  const [dragActive, setDragActive] = createSignal(false)
  const dragging = createMemo(() => dragIndex() != null)
  const normalizedInsert = createMemo(() => {
    const d = dragIndex()
    const ins = insertIndex()
    if (d == null || ins == null)
      return null
    return ins > d ? ins - 1 : ins
  })
  const nonDraggedCount = createMemo(() => {
    const d = dragIndex()
    const n = selectedSorted().length
    return d == null ? n : Math.max(0, n - 1)
  })

  function onDragStart(e: DragEvent, index: number) {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
      e.dataTransfer.setDragImage((e.currentTarget as HTMLElement), 50, 50)
    }
    setInsertIndex(index)
    requestAnimationFrame(() => {
      setDragIndex(index)
      setDragActive(true)
    })
  }

  function onDragEnd() {
    setDragIndex(null)
    setInsertIndex(null)
    setDragActive(false)
  }

  function onSelectedDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer)
      e.dataTransfer.dropEffect = 'move'
    if (dragIndex() != null && insertIndex() == null)
      setInsertIndex(selectedSorted().length)
  }

  function onSelectedDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    const from = dragIndex()
    const to = insertIndex()
    if (from == null || to == null)
      return

    actions.reorder(from, to)
    setDragIndex(null)
    setInsertIndex(null)
    setDragActive(false)
  }

  function onCardDragOver(e: DragEvent, index: number) {
    e.preventDefault()
    if (e.dataTransfer)
      e.dataTransfer.dropEffect = 'move'

    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    const dx = e.clientX - center
    let preRemovalIndex: number | null = null
    if (dx < -DRAG_HYSTERESIS_PX) {
      preRemovalIndex = index
    }
    else if (dx > DRAG_HYSTERESIS_PX) {
      preRemovalIndex = index + 1
    }
    else {
      const prev = insertIndex()
      if (prev === index || prev === index + 1)
        preRemovalIndex = prev
      else
        preRemovalIndex = dx <= 0 ? index : index + 1
    }
    setInsertIndex(preRemovalIndex)
  }

  function GhostPlaceholder() {
    return (
      <div aria-hidden="true" class="border-2 border-zinc-700/40 rounded-xl bg-transparent opacity-100 h-100px w-100px pointer-events-none" />
    )
  }

  return (
    <div class="gap-4 grid lg:grid-cols-2">
      {/* Selector */}
      <div class="space-y-3">
        <For each={ranges()}>
          {range => (
            <div class="space-y-2">
              <div class="text-sm text-emerald-200 font-semibold">{range}</div>
              <div class="gap-3 grid grid-cols-2 lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2">
                <For each={BANNERS.filter(b => !isBannerPast(b) && `${b.start} → ${b.end}` === range)}>
                  {(b) => {
                    const target = () => targets.selected.find(s => s.name === b.featured)
                    return (
                      <button
                        class="text-left"
                        onClick={() => isSelected(b.featured)
                          ? actions.remove(b.featured)
                          : actions.add({ name: b.featured, channel: b.type })}
                        title={`${b.title} (${b.start} → ${b.end})`}
                      >
                        <TargetIconCard
                          name={b.featured}
                          context="selector"
                          selected={isSelected(b.featured)}
                          muted={!isSelected(b.featured)}
                          notMet={isSelected(b.featured) && !fundedSet().has(b.featured)}
                          showMindscapeControls={isSelected(b.featured)}
                          mindscapeCount={target()?.mindscapeCount ?? 0}
                          channel={b.type}
                          onIncrementMindscape={() => actions.incrementMindscape(b.featured)}
                          onDecrementMindscape={() => actions.decrementMindscape(b.featured)}
                        />
                      </button>
                    )
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Selected - showing duplicates as independent cards */}
      <div class="space-y-2">
        <div class="text-sm text-emerald-200 font-semibold">Priority List (duplicates shown)</div>
        <div
          class="flex flex-wrap gap-3 items-start"
          onDragOver={e => onSelectedDragOver(e as unknown as DragEvent)}
          onDrop={e => onSelectedDrop(e as unknown as DragEvent)}
        >
          <For each={selectedSorted()}>
            {(t, i) => {
              const beforeIndex = () => {
                const d = dragIndex()
                const ii = i()
                return d != null && ii > d ? ii - 1 : ii
              }
              const isDragged = () => dragIndex() === i()
              const showBefore = () => {
                if (!dragging())
                  return false
                const ni = normalizedInsert()
                const d = dragIndex()
                if (ni == null || d == null)
                  return false
                if (ni === d)
                  return i() === d
                return ni === beforeIndex()
              }
              const duplicateCount = () => t.mindscapeCount + 1
              return (
                <>
                  <Show when={showBefore()}>
                    <GhostPlaceholder />
                  </Show>

                  <div
                    class="relative"
                    draggable
                    onDragStart={e => onDragStart(e as unknown as DragEvent, i())}
                    onDragEnd={onDragEnd}
                    onDragOver={e => onCardDragOver(e as unknown as DragEvent, i())}
                    style={{ display: isDragged() && dragActive() ? 'none' : undefined }}
                  >
                    {/* Show duplicates as separate cards */}
                    <div class="flex flex-wrap gap-2">
                      <For each={Array.from({ length: duplicateCount() })}>
                        {(_, dupIndex) => (
                          <div class="relative">
                            <TargetIconCard
                              name={t.name}
                              channel={t.channel}
                            />
                            {/* Show mindscape label on each duplicate */}
                            <div class="text-xs text-emerald-200 font-bold px-1.5 py-0.5 border border-zinc-700 rounded bg-zinc-900/90 bottom-1 left-1 absolute backdrop-blur-sm">
                              M
                              {dupIndex()}
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                    {/* Remove button for the entire group */}
                    <button
                      class="p-1 border border-zinc-700 rounded-full bg-zinc-900/90 opacity-0 flex size-8 shadow transition-opacity items-center justify-center absolute hover:border-red-500 hover:bg-red-600/80 group-hover:opacity-100 -right-2 -top-2"
                      aria-label="Remove"
                      onClick={(e) => {
                        e.stopPropagation()
                        actions.remove(t.name)
                      }}
                    >
                      <i class="i-ph:x-bold text-zinc-200 size-4" />
                    </button>
                  </div>
                </>
              )
            }}
          </For>

          <Show when={dragging() && normalizedInsert() === nonDraggedCount() && normalizedInsert() !== dragIndex()}>
            <GhostPlaceholder />
          </Show>
        </div>
      </div>
    </div>
  )
}
