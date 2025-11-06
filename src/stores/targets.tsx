import type { ParentProps } from 'solid-js'
import type { Store } from 'solid-js/store'
import type { Banner, ChannelType } from '~/lib/constants'
import { makePersisted, storageSync } from '@solid-primitives/storage'
import { createContext, untrack, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import { BANNERS } from '~/lib/constants'

export interface SelectedTarget {
  name: string
  channel: ChannelType
  priority: number
  mindscapeCount: number // 0 = M0 (base), 1 = M1, ..., 6 = M6 for agents, 5 = M5 for engines
}

interface TargetsLocalState {
  selected: SelectedTarget[]
}

type StoreContextType = [Store<TargetsLocalState>, {
  add: (t: { name: string, channel: ChannelType }) => void
  remove: (name: string) => void
  setPriority: (name: string, priority: number) => void
  reorder: (fromIndex: number, toIndex: number) => void
  clear: () => void
  incrementMindscape: (name: string) => void
  decrementMindscape: (name: string) => void
  setMindscape: (name: string, count: number) => void
}]

const StoreContext = createContext<StoreContextType>()

export function TargetsStoreProvider(props: ParentProps & { accountId: string }) {
  const [baseLocal, setBaseLocal] = createStore<TargetsLocalState>({
    selected: [],
  })

  const storageKey = untrack(() => `targets:${props.accountId}`)
  const [local, setLocal] = makePersisted([baseLocal, setBaseLocal], {
    name: storageKey,
    storage: window.localStorage,
    sync: storageSync,
  })

  function nextPriority(): number {
    return local.selected.length ? Math.max(...local.selected.map(s => s.priority)) + 1 : 1
  }

  const actions = {
    add: ({ name, channel }: { name: string, channel: ChannelType }) => {
      if (local.selected.some(s => s.name === name))
        return
      setLocal('selected', s => [...s, { name, channel, priority: nextPriority(), mindscapeCount: 0 }])
    },
    remove: (name: string) => {
      setLocal('selected', s => s.filter(x => x.name !== name))
    },
    setPriority: (name: string, priority: number) => {
      setLocal('selected', x => x.name === name, 'priority', priority)
    },
    reorder: (fromIndex: number, toIndex: number) => {
      setLocal('selected', (s) => {
        const arr = [...s].sort((a, b) => a.priority - b.priority)
        const originalLen = arr.length
        const safeFrom = Math.max(0, Math.min(originalLen - 1, fromIndex))
        const [moved] = arr.splice(safeFrom, 1)
        // Clamp target to original bounds (allow inserting at end = originalLen)
        const clampedTarget = Math.max(0, Math.min(originalLen, toIndex))
        // After removal, if target was after the removed index, shift left by 1
        const insertAt = clampedTarget > safeFrom ? clampedTarget - 1 : clampedTarget
        arr.splice(insertAt, 0, moved)
        // reassign priorities 1..n
        return arr.map((item, i) => ({ ...item, priority: i + 1 }))
      })
    },
    clear: () => {
      setLocal('selected', [])
    },
    incrementMindscape: (name: string) => {
      setLocal('selected', x => x.name === name, (target) => {
        const max = target.channel === 'agent' ? 6 : 5
        return { ...target, mindscapeCount: Math.min(max, target.mindscapeCount + 1) }
      })
    },
    decrementMindscape: (name: string) => {
      setLocal('selected', x => x.name === name, (target) => {
        return { ...target, mindscapeCount: Math.max(0, target.mindscapeCount - 1) }
      })
    },
    setMindscape: (name: string, count: number) => {
      setLocal('selected', x => x.name === name, (target) => {
        const max = target.channel === 'agent' ? 6 : 5
        return { ...target, mindscapeCount: Math.max(0, Math.min(max, count)) }
      })
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

export function listFeaturedFromBanners(banners: Banner[] = BANNERS) {
  return banners.map(b => ({ name: b.featured, channel: b.type, banner: b }))
}
