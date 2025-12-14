import type { ParentProps } from 'solid-js'
import type { Store } from 'solid-js/store'
import type { PlannerInputs, Scenario } from '~/lib/planner'
import { makePersisted, storageSync } from '@solid-primitives/storage'
import { batch, createContext, untrack, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'

interface UIState {
}

interface UILocalState {
  plannerInputs: PlannerInputs
  scenario: Scenario
  phaseTimings: Record<number, 'start' | 'end'>
  planningMode: 's-rank' | 'a-rank'
  shareCardPattern: 'diagonal' | 'dots' | 'plus' | 'none'
}

type UIStoreState = UIState & {
  local: UILocalState
}

interface UIStoreActions {
  setPlannerInput: <K extends keyof PlannerInputs>(key: K, value: PlannerInputs[K]) => void
  setPlannerInputs: (updates: Partial<PlannerInputs>) => void
  setScenario: (scenario: UILocalState['scenario']) => void
  setPhaseTiming: (index: number, t: 'start' | 'end') => void
  setPlanningMode: (mode: 's-rank' | 'a-rank') => void
  setShareCardPattern: (pattern: UILocalState['shareCardPattern']) => void
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
    incomes: [75, 75, 75, 75], // Default to 4 phases
    pityAgentStart: 0,
    guaranteedAgentStart: false,
    pityEngineStart: 0,
    guaranteedEngineStart: false,
    luckMode: 'realistic',
  }

  const [baseLocal, setBaseLocal] = createStore<UILocalState>({
    plannerInputs: defaultPlannerInputs,
    scenario: 'p60',
    phaseTimings: {},
    planningMode: 's-rank',
    shareCardPattern: 'diagonal',
  })
  const storageKey = untrack(() => `ui:${props.accountId}`)
  const [local, setLocal] = makePersisted([baseLocal, setBaseLocal], {
    name: storageKey,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    sync: storageSync,
  })

  const actions: UIStoreActions = {
    setPlannerInput: (key, value) => {
      setLocal('plannerInputs', key, value)
    },
    setPlannerInputs: (updates) => {
      batch(() => {
        for (const [key, value] of Object.entries(updates)) {
          setLocal('plannerInputs', key as keyof PlannerInputs, value)
        }
      })
    },
    setScenario: (scenario) => {
      setLocal('scenario', scenario)
    },
    setPhaseTiming: (index, t) => {
      setLocal('phaseTimings', index, t)
    },
    setPlanningMode: (mode) => {
      setLocal('planningMode', mode)
    },
    setShareCardPattern: (pattern) => {
      setLocal('shareCardPattern', pattern)
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
