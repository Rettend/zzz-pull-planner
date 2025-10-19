import type { ParentProps } from 'solid-js'
import type { Store } from 'solid-js/store'
import { makePersisted, storageSync } from '@solid-primitives/storage'
import { createContext, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import { v4 as uuidv4 } from 'uuid'

export interface AccountItem {
  id: string
  name: string
}

interface AccountsLocalState {
  accounts: AccountItem[]
  currentId: string
}

type StoreContextType = [Store<AccountsLocalState>, {
  add: () => string
  select: (id: string) => void
  rename: (id: string, name: string) => void
  remove: (id: string) => void
}]

const StoreContext = createContext<StoreContextType>()

export function AccountsStoreProvider(props: ParentProps) {
  const [baseLocal, setBaseLocal] = createStore<AccountsLocalState>({
    accounts: [{ id: 'default', name: 'Account 1' }],
    currentId: 'default',
  })

  const [local, setLocal] = makePersisted([baseLocal, setBaseLocal], {
    name: 'accounts',
    storage: window.localStorage,
    sync: storageSync,
  })

  const actions = {
    add: () => {
      const id = uuidv4()
      setLocal('accounts', a => [...a, { id, name: `Account ${a.length + 1}` }])
      setLocal('currentId', id)
      return id
    },
    select: (id: string) => {
      const exists = local.accounts.some(a => a.id === id)
      setLocal('currentId', exists ? id : local.currentId)
    },
    rename: (id: string, name: string) => {
      const trimmed = name.trim() || 'Untitled'
      setLocal('accounts', a => a.id === id, 'name', trimmed)
    },
    remove: (id: string) => {
      if (local.accounts.length <= 1)
        return

      try {
        window.localStorage?.removeItem(`ui:${id}`)
        window.localStorage?.removeItem(`targets:${id}`)
      }
      catch {}

      const remaining = local.accounts.filter(a => a.id !== id)
      const nextId = remaining[0]?.id ?? local.currentId
      setLocal('accounts', remaining)
      if (local.currentId === id)
        setLocal('currentId', nextId)
    },
  }

  return (
    <StoreContext.Provider value={[local, actions]}>
      {props.children}
    </StoreContext.Provider>
  )
}

export function useAccountsStore() {
  const ctx = useContext(StoreContext)
  if (!ctx)
    throw new Error('useAccountsStore must be used within an AccountsStoreProvider')
  return ctx
}
