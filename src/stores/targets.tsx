import type { ParentProps } from 'solid-js'
import type { Store } from 'solid-js/store'
import type { Banner, ChannelType } from '~/lib/constants'
import { makePersisted, storageSync } from '@solid-primitives/storage'
import { batch, createContext, untrack, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'

export interface SelectedTarget {
  id: string
  name: string
  channel: ChannelType
  priority: number
  mindscape: number // 0 = M0 (base), 1 = M1, ...
}

export interface TargetAggregate {
  name: string
  channel: ChannelType
  priority: number
  count: number // number of mindscapes requested including base
}

interface TargetsLocalState {
  selected: SelectedTarget[]
}

type StoreContextType = [Store<TargetsLocalState>, {
  add: (t: { name: string, channel: ChannelType }) => void
  remove: (name: string) => void
  reorder: (fromIndex: number, toIndex: number) => void
  clear: () => void
  incrementMindscape: (name: string) => void
  decrementMindscape: (name: string) => void
  removeEntry: (id: string) => void
}]

const StoreContext = createContext<StoreContextType>()

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

function normalizeSelected(list: readonly SelectedTarget[]): SelectedTarget[] {
  const prioritized = list.map((item, index) => ({ ...item, priority: index + 1 }))
  const counts = new Map<string, number>()
  return prioritized.map((item) => {
    const current = counts.get(item.name) ?? 0
    counts.set(item.name, current + 1)
    return { ...item, mindscape: current }
  })
}

interface LegacySelectedTarget {
  name: string
  channel: ChannelType
  priority: number
  mindscapeCount?: number
  mindscape?: number
  id?: string
}

function upgradeSelected(list: readonly LegacySelectedTarget[]): SelectedTarget[] {
  if (!list?.length)
    return []
  const expanded: SelectedTarget[] = []
  const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  for (const item of sorted) {
    const duplicates = (item.mindscapeCount != null ? item.mindscapeCount + 1 : 1)
    if (duplicates > 1) {
      for (let i = 0; i < duplicates; i++) {
        expanded.push({
          id: createId(),
          name: item.name,
          channel: item.channel,
          priority: expanded.length + 1,
          mindscape: i,
        })
      }
      continue
    }
    expanded.push({
      id: item.id ?? createId(),
      name: item.name,
      channel: item.channel,
      priority: expanded.length + 1,
      mindscape: item.mindscape ?? 0,
    })
  }
  return normalizeSelected(expanded)
}

export function TargetsStoreProvider(props: ParentProps & { accountId: string }) {
  const [baseLocal, setBaseLocal] = createStore<TargetsLocalState>({
    selected: [],
  })

  const storageKey = untrack(() => `targets:${props.accountId}`)
  const [local, setLocal] = makePersisted([baseLocal, setBaseLocal], {
    name: storageKey,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    sync: storageSync,
  })

  batch(() => {
    const upgraded = upgradeSelected(local.selected as unknown as LegacySelectedTarget[])
    if (upgraded.length !== local.selected.length || upgraded.some((entry, idx) => entry.id !== (local.selected[idx] as any)?.id))
      setLocal('selected', upgraded)
  })

  function updateSelected(updater: (list: SelectedTarget[]) => SelectedTarget[]) {
    setLocal('selected', current => normalizeSelected(updater([...current])))
  }

  const actions = {
    add: ({ name, channel }: { name: string, channel: ChannelType }) => {
      if (local.selected.some(s => s.name === name))
        return
      updateSelected(list => [...list, { id: createId(), name, channel, priority: list.length + 1, mindscape: 0 }])
    },
    remove: (name: string) => {
      updateSelected(list => list.filter(x => x.name !== name))
    },
    reorder: (fromIndex: number, toIndex: number) => {
      updateSelected((list) => {
        const arr = [...list].sort((a, b) => a.priority - b.priority)
        const originalLen = arr.length
        if (!originalLen)
          return arr
        const safeFrom = Math.max(0, Math.min(originalLen - 1, fromIndex))
        const [moved] = arr.splice(safeFrom, 1)
        const clampedTarget = Math.max(0, Math.min(originalLen, toIndex))
        const insertAt = clampedTarget > safeFrom ? clampedTarget - 1 : clampedTarget
        arr.splice(insertAt, 0, moved)
        return arr
      })
    },
    clear: () => {
      updateSelected(() => [])
    },
    incrementMindscape: (name: string) => {
      updateSelected((list) => {
        const arr = [...list].sort((a, b) => a.priority - b.priority)
        const indices = arr.map((entry, idx) => ({ entry, idx })).filter(item => item.entry.name === name)
        if (!indices.length)
          return arr
        const channel = indices[0].entry.channel
        const maxLevel = channel === 'agent' ? 6 : 5
        if (indices.length >= maxLevel + 1)
          return arr
        const insertAt = indices[indices.length - 1].idx + 1
        arr.splice(insertAt, 0, {
          id: createId(),
          name,
          channel,
          priority: insertAt + 1,
          mindscape: indices.length,
        })
        return arr
      })
    },
    decrementMindscape: (name: string) => {
      updateSelected((list) => {
        const arr = [...list].sort((a, b) => a.priority - b.priority)
        const indices = arr.map((entry, idx) => ({ entry, idx })).filter(item => item.entry.name === name)
        if (!indices.length)
          return arr
        if (indices.length === 1)
          return arr.filter(item => item.name !== name)
        const removeIdx = indices[indices.length - 1].idx
        arr.splice(removeIdx, 1)
        return arr
      })
    },
    removeEntry: (id: string) => {
      updateSelected(list => list.filter(entry => entry.id !== id))
    },
  }

  return (
    <StoreContext.Provider value={[local, actions]}>
      {props.children}
    </StoreContext.Provider>
  )
}

export function useTargetsStore() {
  const ctx = useContext(StoreContext)
  if (!ctx)
    throw new Error('useTargetsStore must be used within a TargetsStoreProvider')
  return ctx
}

export function listFeaturedFromBanners(banners: Banner[]) {
  return banners.map(b => ({ name: b.featured, channel: b.type, banner: b }))
}

export function aggregateTargets(selected: readonly SelectedTarget[]): TargetAggregate[] {
  if (!selected?.length)
    return []
  const ordered = [...selected].sort((a, b) => a.priority - b.priority)
  const map = new Map<string, TargetAggregate>()
  for (const entry of ordered) {
    const existing = map.get(entry.name)
    if (existing) {
      existing.count += 1
      continue
    }
    map.set(entry.name, {
      name: entry.name,
      channel: entry.channel,
      priority: entry.priority,
      count: 1,
    })
  }
  return Array.from(map.values()).sort((a, b) => a.priority - b.priority)
}
