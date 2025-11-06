import type { ParentProps } from 'solid-js'
import type { Store } from 'solid-js/store'
import type { ChannelType } from '~/lib/constants'
import type { PlannerInputs, Scenario } from '~/lib/planner'
import { makePersisted, storageSync } from '@solid-primitives/storage'
import { createContext, untrack, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'

interface UIState {
}

interface UILocalState {
  plannerInputs: PlannerInputs
  scenario: Scenario
  phase1Timing: 'start' | 'end'
  phase2Timing: 'start' | 'end'
  currentBannerType: ChannelType
}

type UIStoreState = UIState & {
  local: UILocalState
}

interface UIStoreActions {
  setPlannerInput: <K extends keyof PlannerInputs>(key: K, value: PlannerInputs[K]) => void
  setScenario: (scenario: UILocalState['scenario']) => void
  setPhase1Timing: (t: 'start' | 'end') => void
  setPhase2Timing: (t: 'start' | 'end') => void
  setCurrentBannerType: (t: ChannelType) => void
  resetPlannerInputs: () => void
}

type StoreContextType = [Store<UIState>, Store<UILocalState>, UIStoreActions]
const StoreContext = createContext<StoreContextType>()

export function UIStoreProvider(props: ParentProps<{ accountId: string }>) {
  const [state, _setState] = createStore<UIState>({
  })

  const defaultPlannerInputs: PlannerInputs = {
    N: 60,
    pullsOnHand: 0,
    incomePhase1: 75,
    incomePhase2: 75,
    pityAgentStart: 0,
    guaranteedAgentStart: false,
    pityEngineStart: 0,
    guaranteedEngineStart: false,
    luckMode: 'realistic',
  }

  const [baseLocal, setBaseLocal] = createStore<UILocalState>({
    plannerInputs: defaultPlannerInputs,
    scenario: 'p60',
    phase1Timing: 'end',
    phase2Timing: 'end',
    currentBannerType: 'agent',
  })
  const storageKey = untrack(() => `ui:${props.accountId}`)
  const [local, setLocal] = makePersisted([baseLocal, setBaseLocal], {
    name: storageKey,
    storage: window.localStorage,
    sync: storageSync,
  })

  const actions: UIStoreActions = {
    setPlannerInput: (key, value) => {
      setLocal('plannerInputs', key, value)
    },
    setScenario: (scenario) => {
      setLocal('scenario', scenario)
    },
    setPhase1Timing: (t) => {
      setLocal('phase1Timing', t)
    },
    setPhase2Timing: (t) => {
      setLocal('phase2Timing', t)
    },
    setCurrentBannerType: (t) => {
      setLocal('currentBannerType', t)
    },
    resetPlannerInputs: () => {
      setLocal('plannerInputs', defaultPlannerInputs)
    },
  }

  return (
    <StoreContext.Provider value={[state, local, actions]}>
      {props.children}
    </StoreContext.Provider>
  )
}

export function useUIStore(): [UIStoreState, UIStoreActions] {
  const context = useContext(StoreContext)
  if (!context)
    throw new Error('useUIStore must be used within a UIStoreProvider')

  const [state, local, actions] = context

  return [
    Object.create(state, {
      local: {
        get: () => local,
        enumerable: true,
      },
    }),
    actions,
  ]
}
