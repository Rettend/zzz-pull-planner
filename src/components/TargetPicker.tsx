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

  // Drag state for better UX
  const [dragIndex, setDragIndex] = createSignal<number | null>(null)
  const [overIndex, setOverIndex] = createSignal<number | null>(null)
  const [overPos, setOverPos] = createSignal<'before' | 'after'>('before')

  function onDragStart(e: DragEvent, index: number) {
    setDragIndex(index)
    setOverIndex(null)
    setOverPos('before')
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
      e.dataTransfer.setDragImage((e.currentTarget as HTMLElement), 50, 50)
    }
  }

  function computeSide(e: DragEvent, el: HTMLElement): 'before' | 'after' {
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    return x < rect.width / 2 ? 'before' : 'after'
  }

  function onDragOverCard(e: DragEvent, index: number) {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    if (e.dataTransfer)
      e.dataTransfer.dropEffect = 'move'
    setOverIndex(index)
    setOverPos(computeSide(e, el))
  }

  function onDragLeaveCard(_e: DragEvent, index: number) {
    // Only clear if leaving the currently hovered card
    if (overIndex() === index)
      setOverIndex(null)
  }

  function onDrop(e: DragEvent, toIndex: number) {
    e.preventDefault()
    const data = e.dataTransfer?.getData('text/plain')
    const fromIndex = Number.isFinite(Number(data)) ? Number(data) : dragIndex()
    if (fromIndex == null)
      return
    const pos = overPos()
    const insertIndex = toIndex + (pos === 'after' ? 1 : 0)
    actions.reorder(fromIndex, insertIndex)
    setDragIndex(null)
    setOverIndex(null)
  }

  function onDragEnd() {
    setDragIndex(null)
    setOverIndex(null)
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
        <div class="flex flex-wrap gap-3">
          <For each={selectedSorted()}>
            {(t, i) => (
              <div
                class="relative"
                draggable
                onDragStart={e => onDragStart(e as unknown as DragEvent, i())}
                onDragOver={e => onDragOverCard(e as unknown as DragEvent, i())}
                onDragLeave={e => onDragLeaveCard(e as unknown as DragEvent, i())}
                onDrop={e => onDrop(e as unknown as DragEvent, i())}
                onDragEnd={onDragEnd}
              >
                <TargetIconCard
                  name={t.name}
                  removable
                  onRemove={() => actions.remove(t.name)}
                />
                <Show when={dragIndex() !== null && overIndex() === i()}>
                  <div
                    class="pointer-events-none bottom-0 top-0 absolute"
                    classList={{
                      '-left-1': overPos() === 'before',
                      '-right-1': overPos() === 'after',
                    }}
                    style={{ 'width': '3px', 'background-color': 'rgba(16, 185, 129, 0.9)', 'border-radius': '2px' }}
                  />
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
