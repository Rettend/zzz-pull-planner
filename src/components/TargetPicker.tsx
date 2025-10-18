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
  const [insertIndex, setInsertIndex] = createSignal<number | null>(null)
  const cardEls: HTMLElement[] = []
  const [currentRowIdx, setCurrentRowIdx] = createSignal<number | null>(null)
  const ROW_GROUP_TOLERANCE_PX = 40
  const ROW_HYSTERESIS_PX = 16

  function onDragStart(e: DragEvent, index: number) {
    setDragIndex(index)
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
      e.dataTransfer.setDragImage((e.currentTarget as HTMLElement), 50, 50)
    }
  }

  function onDragEnd() {
    setDragIndex(null)
    setInsertIndex(null)
    setCurrentRowIdx(null)
  }

  // Compute insertion index from pointer position relative to card centers (container-level)
  function updateInsertFromPointer(e: DragEvent) {
    if (dragIndex() == null)
      return
    const cards = cardEls.filter(Boolean)
    const total = cards.length
    if (!total) {
      setInsertIndex(0)
      return
    }
    const px = e.clientX
    const py = e.clientY

    const rects = cards.map(el => el.getBoundingClientRect())

    // Group cards into visual rows by their top coordinate
    const indexed = rects.map((r, i) => ({ i, r }))
    indexed.sort((a, b) => (a.r.top - b.r.top) || (a.r.left - b.r.left))
    const rows: { indices: number[], top: number, bottom: number, centerY: number }[] = []
    for (const item of indexed) {
      const { i, r } = item
      const last = rows[rows.length - 1]
      if (!last || Math.abs(r.top - last.top) > ROW_GROUP_TOLERANCE_PX) {
        rows.push({ indices: [i], top: r.top, bottom: r.bottom, centerY: (r.top + r.bottom) / 2 })
      }
      else {
        last.indices.push(i)
        last.top = Math.min(last.top, r.top)
        last.bottom = Math.max(last.bottom, r.bottom)
        last.centerY = (last.top + last.bottom) / 2
      }
    }

    // Choose row with hysteresis to avoid flicker when hovering between rows
    let bestRow = 0
    let bestDy = Number.POSITIVE_INFINITY
    for (let r = 0; r < rows.length; r++) {
      const dy = Math.abs(py - rows[r].centerY)
      if (dy < bestDy) {
        bestDy = dy
        bestRow = r
      }
    }
    const prevRow = currentRowIdx()
    if (prevRow != null) {
      const dyPrev = Math.abs(py - rows[prevRow].centerY)
      if (bestRow !== prevRow && dyPrev <= ROW_HYSTERESIS_PX)
        bestRow = prevRow
    }
    setCurrentRowIdx(bestRow)

    // Within the chosen row, find slot by comparing against card centers
    const rowIndices = rows[bestRow].indices
    const centers = rowIndices.map((idx) => {
      const r = rects[idx]
      return r.left + r.width / 2
    })

    let within = 0
    while (within < centers.length && px >= centers[within])
      within += 1

    // Convert row + within to global insert index (DOM order)
    let beforeCount = 0
    for (let r = 0; r < bestRow; r++)
      beforeCount += rows[r].indices.length

    const target = Math.max(0, Math.min(total, beforeCount + within))
    setInsertIndex(target)
  }

  function onSelectedDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer)
      e.dataTransfer.dropEffect = 'move'
    updateInsertFromPointer(e)
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
    setCurrentRowIdx(null)
  }

  // Dedicated drop slot – visual only, ghost placeholder
  function DropSlot(props: { index: number }) {
    const show = createMemo(() => {
      const d = dragIndex()
      const ins = insertIndex()
      if (d == null || ins == null)
        return false
      if (ins === d || ins === d + 1)
        return false // hide when drop would be a no-op
      return ins === props.index
    })
    return (
      <div
        class="h-100px inline-block transition-all duration-150 ease-out relative"
        classList={{ 'w-100px': show(), 'w-3': !show() }}
      >
        <Show when={show()}>
          <div aria-hidden="true" class="border-2 border-zinc-700/40 rounded-xl bg-transparent opacity-100 h-100px w-100px pointer-events-none scale-100 transition-all duration-150 ease-out left-1/2 top-0 absolute -translate-x-1/2" />
        </Show>
      </div>
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
          <DropSlot index={0} />
          <For each={selectedSorted()}>
            {(t, i) => (
              <>
                <div
                  class="relative"
                  draggable
                  onDragStart={e => onDragStart(e as unknown as DragEvent, i())}
                  onDragEnd={onDragEnd}
                  ref={(el) => { cardEls[i()] = el as unknown as HTMLElement }}
                >
                  <TargetIconCard
                    name={t.name}
                    removable
                    onRemove={() => actions.remove(t.name)}
                  />
                </div>
                <DropSlot index={i() + 1} />
              </>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
