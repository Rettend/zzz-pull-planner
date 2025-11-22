import type { Component } from 'solid-js'
import type { Banner, ChannelType } from '~/lib/constants'
import type { TargetAggregate } from '~/stores/targets'
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { isBannerPast } from '~/lib/constants'
import { computePlan, emptyPlan } from '~/lib/planner'
import { useGame } from '~/stores/game'
import { aggregateTargets, useTargetsStore } from '~/stores/targets'
import { useUIStore } from '~/stores/ui'
import { TargetIconCard } from './TargetIconCard'

export const TargetPicker: Component = () => {
  const [targets, actions] = useTargetsStore()
  const [ui, uiActions] = useUIStore()
  const game = useGame()

  const inputs = createMemo(() => ui.local.plannerInputs)
  const scenario = createMemo(() => ui.local.scenario)
  const planningMode = createMemo(() => ui.local.planningMode)
  const isARankMode = createMemo(() => planningMode() === 'a-rank')

  const activeBanners = createMemo(() => game.banners().filter(b => !isBannerPast(b)))
  const ranges = createMemo(() => [...new Set(activeBanners().map(b => `${b.start} → ${b.end}`))])
  const bannersByRange = createMemo(() => {
    const map = new Map<string, Banner[]>()
    for (const b of activeBanners()) {
      const range = `${b.start} → ${b.end}`
      const list = map.get(range) ?? []
      list.push(b)
      map.set(range, list)
    }
    return map
  })
  const selectedEntries = createMemo(() => [...targets.selected].sort((a, b) => a.priority - b.priority))
  const aggregatedSelected = createMemo(() => aggregateTargets(selectedEntries()))
  const aggregatedMap = createMemo(() => {
    const map = new Map<string, TargetAggregate>()
    for (const entry of aggregatedSelected())
      map.set(entry.name, entry)
    return map
  })
  const selectedTargetsInput = createMemo(() => {
    const mode = planningMode()
    return selectedEntries()
      .filter((t) => {
        const meta = t.channel === 'agent' ? game.resolveAgent(t.name) : game.resolveWEngine(t.name)
        const rarity = meta?.rarity ?? 5
        return mode === 's-rank' ? rarity === 5 : rarity === 4
      })
      .map(t => ({ name: t.name, channel: t.channel }))
  })
  const plan = createMemo(() => {
    try {
      return computePlan(activeBanners(), inputs(), scenario(), selectedTargetsInput())
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

  const visibleSelectedTargets = createMemo(() => {
    return selectedEntries().filter((t) => {
      const meta = t.channel === 'agent' ? game.resolveAgent(t.name) : game.resolveWEngine(t.name)
      const rarity = meta?.rarity ?? 5
      return isARankMode() ? rarity === 4 : rarity === 5
    })
  })

  const [touchTimeout, setTouchTimeout] = createSignal<number | null>(null)
  const [ghostPosition, setGhostPosition] = createSignal<{ x: number, y: number } | null>(null)
  const [touchStartPos, setTouchStartPos] = createSignal<{ x: number, y: number } | null>(null)

  function handleTouchStart(e: TouchEvent, index: number) {
    if (e.touches.length !== 1)
      return

    const touch = e.touches[0]
    const startX = touch.clientX
    const startY = touch.clientY
    setTouchStartPos({ x: startX, y: startY })

    const timeout = window.setTimeout(() => {
      // Long press triggered
      setDragIndex(index)
      setDragActive(true)
      setGhostPosition({ x: startX, y: startY })

      // Vibrate if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate)
        navigator.vibrate(50)
    }, 200) // 200ms long press

    setTouchTimeout(timeout)
  }

  createEffect(() => {
    if (dragActive()) {
      // Prevent browser scrolling
      document.body.style.touchAction = 'none'

      const preventScroll = (e: TouchEvent) => {
        if (e.cancelable)
          e.preventDefault()
      }
      // Add to window as well to catch everything
      window.addEventListener('touchmove', preventScroll, { passive: false })
      document.addEventListener('touchmove', preventScroll, { passive: false })

      onCleanup(() => {
        document.body.style.touchAction = ''
        window.removeEventListener('touchmove', preventScroll)
        document.removeEventListener('touchmove', preventScroll)
      })
    }
  })

  function handleTouchMove(e: TouchEvent) {
    const timeout = touchTimeout()
    if (timeout) {
      const touch = e.touches[0]
      const start = touchStartPos()
      if (start && (Math.abs(touch.clientX - start.x) > 10 || Math.abs(touch.clientY - start.y) > 10)) {
        // Moved too much before long press -> cancel
        clearTimeout(timeout)
        setTouchTimeout(null)
        setTouchStartPos(null)
      }
    }

    if (dragActive() && ghostPosition()) {
      const touch = e.touches[0]
      setGhostPosition({ x: touch.clientX, y: touch.clientY })

      // Find target under finger
      const element = document.elementFromPoint(touch.clientX, touch.clientY)
      const targetCard = element?.closest('[data-sort-index]') as HTMLElement

      if (targetCard) {
        const index = Number.parseInt(targetCard.dataset.sortIndex || '-1')
        if (index !== -1 && index !== dragIndex()) {
          // Calculate if we are closer to the left or right/bottom
          const rect = targetCard.getBoundingClientRect()
          const center = rect.left + rect.width / 2
          // Simple logic: if we are on a card, we swap with it (or insert before/after)
          // Reusing the existing logic might be tricky without the event dx.
          // Let's just set insertIndex to the target's index
          // But we need to know if we are "after" it.
          // For simplicity in grid, let's just say if we overlap > 50%?
          // Or just simple: if we are over it, we target it.

          // Let's refine: if x > center, insert after.
          const isAfter = touch.clientX > center
          setInsertIndex(isAfter ? index + 1 : index)
        }
      }
    }
  }

  function handleTouchEnd() {
    const timeout = touchTimeout()
    if (timeout) {
      clearTimeout(timeout)
      setTouchTimeout(null)
    }
    setTouchStartPos(null)

    if (dragActive() && ghostPosition()) {
      // Commit drop
      const fromLocal = dragIndex()
      const toLocal = insertIndex()

      if (fromLocal != null && toLocal != null) {
        // Reuse the logic from onSelectedDrop but we need to call it or duplicate it
        // Let's extract the reorder logic
        commitReorder(fromLocal, toLocal)
      }

      setDragIndex(null)
      setInsertIndex(null)
      setDragActive(false)
      setGhostPosition(null)
    }
  }

  function commitReorder(fromLocal: number, toLocal: number) {
    const visible = visibleSelectedTargets()
    const all = selectedEntries()

    const item = visible[fromLocal]
    if (!item)
      return
    const fromGlobal = all.findIndex(x => x.id === item.id)
    if (fromGlobal === -1)
      return

    let toGlobal: number
    if (toLocal < visible.length) {
      const targetItem = visible[toLocal]
      toGlobal = all.findIndex(x => x.id === targetItem.id)
    }
    else {
      const lastVisible = visible[visible.length - 1]
      const lastGlobal = all.findIndex(x => x.id === lastVisible.id)
      toGlobal = lastGlobal + 1
    }

    if (toGlobal === -1)
      return

    actions.reorder(fromGlobal, toGlobal)
  }

  function onSelectedDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    const fromLocal = dragIndex()
    const toLocal = insertIndex()
    if (fromLocal == null || toLocal == null)
      return

    commitReorder(fromLocal, toLocal)
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
        <div class="p-1 border border-zinc-700/50 rounded-lg bg-zinc-800/50 flex gap-2">
          <button
            class={`text-xs tracking-wider font-bold py-1.5 rounded-md flex-1 uppercase transition-colors ${!isARankMode() ? 'bg-gradient-to-b from-[#fff200] to-[#ff8200] text-zinc-900 border border-[#fff200]' : 'text-zinc-500 hover:text-zinc-300'}`}
            onClick={() => uiActions.setPlanningMode('s-rank')}
          >
            S-Rank
          </button>
          <button
            class={`text-xs tracking-wider font-bold py-1.5 rounded-md flex-1 uppercase transition-colors ${isARankMode() ? 'bg-gradient-to-b from-[#ff59ff] to-[#ab2bfa] text-zinc-900 border border-[#ff59ff]' : 'text-zinc-500 hover:text-zinc-300'}`}
            onClick={() => uiActions.setPlanningMode('a-rank')}
          >
            A-Rank
          </button>
        </div>

        <For each={ranges()}>
          {range => (
            <div class="space-y-2">
              <div class="text-sm text-emerald-200 font-semibold">{range}</div>
              <div class="gap-3 grid grid-cols-2 lg:grid-cols-3 md:grid-cols-4 xl:grid-cols-4">
                {(() => {
                  const uniqueTargets = createMemo(() => {
                    const banners = bannersByRange().get(range) || []
                    const map = new Map<string, { name: string, channel: ChannelType, banner: Banner }>()
                    for (const b of banners) {
                      const targets = isARankMode() ? b.featuredARanks : [b.featured]
                      for (const t of targets) {
                        if (!map.has(t)) {
                          map.set(t, { name: t, channel: b.type, banner: b })
                        }
                      }
                    }
                    return Array.from(map.values())
                  })

                  return (
                    <For each={uniqueTargets()}>
                      {({ name: targetName, channel, banner: b }) => {
                        const target = () => findAggregate(targetName)
                        return (
                          <button
                            class="text-left"
                            onClick={() => isSelected(targetName)
                              ? actions.remove(targetName)
                              : actions.add({ name: targetName, channel })}
                            title={`${b.title} (${b.start} → ${b.end})`}
                          >
                            <TargetIconCard
                              name={targetName}
                              context="selector"
                              selected={isSelected(targetName)}
                              muted={!isSelected(targetName)}
                              notMet={isSelected(targetName) && !isFullyFunded()(targetName)}
                              showMindscapeControls
                              mindscapeLevel={target() ? target()!.count - 1 : undefined}
                              channel={channel}
                              onIncrementMindscape={() => handleIncrement(targetName, channel)}
                              onDecrementMindscape={() => handleDecrement(targetName)}
                            />
                          </button>
                        )
                      }}
                    </For>
                  )
                })()}
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
          <For each={visibleSelectedTargets()}>
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
                    class="group select-none relative"
                    draggable
                    data-sort-index={i()}
                    onDragStart={e => onDragStart(e, i())}
                    onDragEnd={onDragEnd}
                    onDragOver={e => onCardDragOver(e, i())}
                    onTouchStart={e => handleTouchStart(e, i())}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={e => e.preventDefault()}
                    style={{
                      display: isDragged() && dragActive() ? 'none' : undefined,
                    }}
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
                      class="p-1 border border-zinc-700 rounded-full bg-zinc-900/90 opacity-0 flex size-8 shadow transition-all items-center justify-center absolute hover:border-red-500 hover:bg-red-600/80 group-hover:opacity-100 -right-2 -top-2"
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

      <Show when={ghostPosition() && dragIndex() != null}>
        <Portal>
          <div
            class="pointer-events-none fixed z-50"
            style={{
              left: `${ghostPosition()!.x}px`,
              top: `${ghostPosition()!.y}px`,
              transform: 'translate(-50%, -50%) scale(1.1)',
            }}
          >
            <Show when={visibleSelectedTargets()[dragIndex()!]}>
              {item => (
                <div class="shadow-2xl relative">
                  <TargetIconCard
                    name={item().name}
                    channel={item().channel}
                    context="selected"
                  />
                  <div class="text-xs text-emerald-200 font-bold px-1.5 py-0.5 border border-zinc-700 rounded bg-zinc-900/90 bottom-1 left-1 absolute backdrop-blur-sm">
                    M
                    {item().mindscape}
                  </div>
                </div>
              )}
            </Show>
          </div>
        </Portal>
      </Show>
    </div>
  )
}
