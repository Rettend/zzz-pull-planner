import type { ParentProps } from 'solid-js'
import type { Store } from 'solid-js/store'
import { createContext, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'

// UI state that doesn't need to persist (session-level only)
interface UILocalState {
  shareCardPattern: 'diagonal' | 'dots' | 'plus' | 'none'
  savePlanBannerShown: boolean
  savePlanBannerDismissed: boolean
}

interface UIStoreActions {
  setShareCardPattern: (pattern: UILocalState['shareCardPattern']) => void
  setSavePlanBannerShown: (shown: boolean) => void
  setSavePlanBannerDismissed: (dismissed: boolean) => void
}

type StoreContextType = [Store<UILocalState>, UIStoreActions]
const StoreContext = createContext<StoreContextType>()

export function UIStoreProvider(props: ParentProps) {
  const [local, setLocal] = createStore<UILocalState>({
    shareCardPattern: 'diagonal',
    savePlanBannerShown: false,
    savePlanBannerDismissed: false,
  })

  const actions: UIStoreActions = {
    setShareCardPattern: (pattern) => {
      setLocal('shareCardPattern', pattern)
    },
    setSavePlanBannerShown: (shown) => {
      setLocal('savePlanBannerShown', shown)
    },
    setSavePlanBannerDismissed: (dismissed) => {
      setLocal('savePlanBannerDismissed', dismissed)
    },
  }

  return (
    <StoreContext.Provider value={[local, actions]}>
      {props.children}
    </StoreContext.Provider>
  )
}

interface UIStoreState {
  local: UILocalState
}

export function useUIStore(): [UIStoreState, UIStoreActions] {
  const context = useContext(StoreContext)
  if (!context)
    throw new Error('useUIStore must be used within a UIStoreProvider')

  const [local, actions] = context

  // Wrap in object with .local for backwards compatibility with existing code
  return [{ local } as UIStoreState, actions]
}
