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

  // Drag-derived helpers
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
    // Delay state change to the next frame to avoid cancelling native drag
    requestAnimationFrame(() => {
      setDragIndex(index)
      // insertIndex will be computed from pointer on first dragover
      setInsertIndex(null as unknown as number)
    })
  }

  function onDragEnd() {
    setDragIndex(null)
    setInsertIndex(null)
    setCurrentRowIdx(null)
    setDragActive(false)
  }

  // Compute insertion index from pointer position relative to card centers (container-level)
  function updateInsertFromPointer(e: DragEvent) {
    if (dragIndex() == null)
      return
    const elements = cardEls.filter(Boolean)
    const allRects = elements.map(el => el.getBoundingClientRect())
    // Exclude zero-sized (hidden/collapsed) items such as the dragged one
    const dIdx = dragIndex() ?? -1
    const indexed = allRects
      .map((r, i) => ({ i, r }))
      .filter(x => x.i !== dIdx)
      .filter(x => x.r.width > 0 && x.r.height > 0)
    const total = indexed.length
    if (!total) {
      setInsertIndex(0)
      return
    }
    const px = e.clientX
    const py = e.clientY

    // Group cards into visual rows by their top coordinate
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
    if (prevRow != null && prevRow >= 0 && prevRow < rows.length) {
      const dyPrev = Math.abs(py - rows[prevRow].centerY)
      if (bestRow !== prevRow && dyPrev <= ROW_HYSTERESIS_PX)
        bestRow = prevRow
    }
    setCurrentRowIdx(bestRow)

    // Within the chosen row, find slot by comparing against card centers
    const rowIndices = rows[bestRow].indices
    const centers = rowIndices.map((idx) => {
      const r = allRects[idx]
      return r.left + r.width / 2
    })

    let within = 0
    while (within < centers.length && px >= centers[within])
      within += 1

    // Convert row + within to global insert index (DOM order)
    let beforeCount = 0
    for (let r = 0; r < bestRow; r++)
      beforeCount += rows[r].indices.length

    const targetBase = Math.max(0, Math.min(total, beforeCount + within))
    // Convert from "list without dragged item" to pre-removal slot index
    const from = dragIndex()!
    const origCount = selectedSorted().length
    const preRemoval = targetBase >= from ? targetBase + 1 : targetBase
    const clampedPreRemoval = Math.max(0, Math.min(origCount, preRemoval))
    setInsertIndex(clampedPreRemoval)
  }

  function onSelectedDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer)
      e.dataTransfer.dropEffect = 'move'
    if (dragIndex() != null && !dragActive())
      setDragActive(true)
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
    setDragActive(false)
  }

  // Legacy DropSlot removed; we now render a single GhostPlaceholder at the target insert index

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
                    ref={(el) => { cardEls[i()] = el as unknown as HTMLElement }}
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
