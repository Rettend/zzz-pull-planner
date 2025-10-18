import type { ParentProps } from 'solid-js'
import type { Store } from 'solid-js/store'
import type { Banner, ChannelType } from '~/lib/constants'
import { makePersisted, storageSync } from '@solid-primitives/storage'
import { createContext, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import { BANNERS } from '~/lib/constants'

export interface SelectedTarget {
  name: string
  channel: ChannelType
  priority: number
  mustHave: boolean
}

interface TargetsLocalState {
  selected: SelectedTarget[]
}

type StoreContextType = [Store<TargetsLocalState>, {
  add: (t: { name: string, channel: ChannelType, mustHave?: boolean }) => void
  remove: (name: string) => void
  setPriority: (name: string, priority: number) => void
  toggleMustHave: (name: string) => void
  reorder: (fromIndex: number, toIndex: number) => void
  clear: () => void
}]

const StoreContext = createContext<StoreContextType>()

export function TargetsStoreProvider(props: ParentProps) {
  const [baseLocal, setBaseLocal] = createStore<TargetsLocalState>({
    selected: [],
  })

  const [local, setLocal] = makePersisted([baseLocal, setBaseLocal], {
    name: 'targets',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    sync: storageSync,
  })

  function nextPriority(): number {
    return local.selected.length ? Math.max(...local.selected.map(s => s.priority)) + 1 : 1
  }

  const actions = {
    add: ({ name, channel, mustHave }: { name: string, channel: ChannelType, mustHave?: boolean }) => {
      if (local.selected.some(s => s.name === name))
        return
      setLocal('selected', s => [...s, { name, channel, priority: nextPriority(), mustHave: Boolean(mustHave) }])
    },
    remove: (name: string) => {
      setLocal('selected', s => s.filter(x => x.name !== name))
    },
    setPriority: (name: string, priority: number) => {
      setLocal('selected', x => x.name === name, 'priority', priority)
    },
    toggleMustHave: (name: string) => {
      setLocal('selected', x => x.name === name, 'mustHave', v => !v)
    },
    reorder: (fromIndex: number, toIndex: number) => {
      setLocal('selected', (s) => {
        const arr = [...s].sort((a, b) => a.priority - b.priority)
        const safeFrom = Math.max(0, Math.min(arr.length - 1, fromIndex))
        const [moved] = arr.splice(safeFrom, 1)
        // After removal, if we insert past the original index, shift left by 1
        let insertAt = Math.max(0, Math.min(arr.length, toIndex))
        if (insertAt > safeFrom)
          insertAt -= 1
        arr.splice(insertAt, 0, moved)
        // reassign priorities 1..n
        return arr.map((item, i) => ({ ...item, priority: i + 1 }))
      })
    },
    clear: () => {
      setLocal('selected', [])
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
