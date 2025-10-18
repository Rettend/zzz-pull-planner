import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { BANNERS, isBannerPast } from '~/lib/constants'
import { useTargetsStore } from '~/stores/targets'
import { TargetIconCard } from './TargetIconCard'

export const TargetPicker: Component = () => {
  const [targets, actions] = useTargetsStore()

  const ranges = createMemo(() => [...new Set(BANNERS.filter(b => !isBannerPast(b)).map(b => `${b.start} → ${b.end}`))])
  const selectedSorted = createMemo(() => [...targets.selected].sort((a, b) => a.priority - b.priority))
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
              <div class="gap-3 grid grid-cols-2 lg:grid-cols-4 md:grid-cols-4 sm:grid-cols-3">
                <For each={BANNERS.filter(b => !isBannerPast(b) && `${b.start} → ${b.end}` === range)}>
                  {b => (
                    <button
                      class="text-left"
                      onClick={() => isSelected(b.featured)
                        ? actions.remove(b.featured)
                        : actions.add({ name: b.featured, channel: b.type })}
                      title={`${b.title} (${b.start} → ${b.end})`}
                    >
                      <TargetIconCard name={b.featured} context="selector" selected={isSelected(b.featured)} muted={!isSelected(b.featured)} />
                    </button>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Selected */}
      <div class="space-y-2">
        <div class="text-sm text-emerald-200 font-semibold">Selected (drag to reorder)</div>
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
                    <TargetIconCard
                      name={t.name}
                      removable
                      onRemove={() => actions.remove(t.name)}
                    />
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
