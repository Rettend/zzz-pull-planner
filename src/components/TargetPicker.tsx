import type { Component } from 'solid-js'
import type { ChannelType } from '~/lib/constants'
import type { TargetAggregate } from '~/stores/targets'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { BANNERS, isBannerPast } from '~/lib/constants'
import { computeTwoPhasePlan, emptyPlan } from '~/lib/planner'
import { aggregateTargets, useTargetsStore } from '~/stores/targets'
import { useUIStore } from '~/stores/ui'
import { TargetIconCard } from './TargetIconCard'

export const TargetPicker: Component = () => {
  const [targets, actions] = useTargetsStore()
  const [ui] = useUIStore()

  const inputs = () => ui.local.plannerInputs
  const scenario = () => ui.local.scenario

  const ranges = createMemo(() => [...new Set(BANNERS.filter(b => !isBannerPast(b)).map(b => `${b.start} → ${b.end}`))])
  const selectedEntries = createMemo(() => [...targets.selected].sort((a, b) => a.priority - b.priority))
  const aggregatedSelected = createMemo(() => aggregateTargets(selectedEntries()))
  const aggregatedMap = createMemo(() => {
    const map = new Map<string, TargetAggregate>()
    for (const entry of aggregatedSelected())
      map.set(entry.name, entry)
    return map
  })
  const selectedTargetsInput = createMemo(() => selectedEntries().map(t => ({ name: t.name, channel: t.channel })))
  const plan = createMemo(() => {
    try {
      return computeTwoPhasePlan(inputs(), scenario(), selectedTargetsInput())
    }
    catch {
      return emptyPlan()
    }
  })
  const isSelected = (name: string) => aggregatedMap().has(name)
  const findAggregate = (name: string) => aggregatedMap().get(name)

  const isFullyFunded = createMemo(() => {
    const funded = plan().fundedTargets
    const fundedCounts = new Map<string, number>()

    for (const name of funded) {
      fundedCounts.set(name, (fundedCounts.get(name) ?? 0) + 1)
    }

    const aggregates = aggregatedMap()

    return (name: string) => {
      const target = aggregates.get(name)
      if (!target)
        return false
      const requiredCount = target.count
      const fundedCount = fundedCounts.get(name) ?? 0
      return fundedCount >= requiredCount
    }
  })

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
    const n = selectedEntries().length
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
      setInsertIndex(selectedEntries().length)
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

  function handleIncrement(name: string, channel: ChannelType) {
    if (!isSelected(name)) {
      actions.add({ name, channel })
      return
    }

    actions.incrementMindscape(name)
  }

  function handleDecrement(name: string) {
    if (!isSelected(name))
      return

    const target = findAggregate(name)
    if (!target)
      return

    if (target.count <= 1) {
      actions.remove(name)
      return
    }

    actions.decrementMindscape(name)
  }

  return (
    <div class="gap-4 grid lg:grid-cols-2">
      {/* Selector */}
      <div class="space-y-3">
        <For each={ranges()}>
          {range => (
            <div class="space-y-2">
              <div class="text-sm text-emerald-200 font-semibold">{range}</div>
              <div class="gap-3 grid grid-cols-2 lg:grid-cols-3 md:grid-cols-4 xl:grid-cols-4">
                <For each={BANNERS.filter(b => !isBannerPast(b) && `${b.start} → ${b.end}` === range)}>
                  {(b) => {
                    const target = () => findAggregate(b.featured)
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
                          notMet={isSelected(b.featured) && !isFullyFunded()(b.featured)}
                          showMindscapeControls
                          mindscapeLevel={target() ? target()!.count - 1 : undefined}
                          channel={b.type}
                          onIncrementMindscape={() => handleIncrement(b.featured, b.type)}
                          onDecrementMindscape={() => handleDecrement(b.featured)}
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

      {/* Selected */}
      <div class="space-y-2">
        <div class="text-sm text-emerald-200 font-semibold">Priority List</div>
        <div
          class="flex flex-wrap gap-3 items-start"
          onDragOver={e => onSelectedDragOver(e)}
          onDrop={e => onSelectedDrop(e)}
        >
          <For each={selectedEntries()}>
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
                    onDragStart={e => onDragStart(e, i())}
                    onDragEnd={onDragEnd}
                    onDragOver={e => onCardDragOver(e, i())}
                    style={{ display: isDragged() && dragActive() ? 'none' : undefined }}
                  >
                    <div class="relative">
                      <TargetIconCard
                        name={t.name}
                        channel={t.channel}
                        context="selected"
                      />
                      <div class="text-xs text-emerald-200 font-bold px-1.5 py-0.5 border border-zinc-700 rounded bg-zinc-900/90 bottom-1 left-1 absolute backdrop-blur-sm">
                        M
                        {t.mindscape}
                      </div>
                    </div>
                    <button
                      class="p-1 border border-zinc-700 rounded-full bg-zinc-900/90 opacity-0 flex size-8 shadow transition-opacity items-center justify-center absolute hover:border-red-500 hover:bg-red-600/80 group-hover:opacity-100 -right-2 -top-2"
                      aria-label="Remove mindscape"
                      onClick={(e) => {
                        e.stopPropagation()
                        actions.removeEntry(t.id)
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
