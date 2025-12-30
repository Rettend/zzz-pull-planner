import type { Accessor, ParentProps } from 'solid-js'
import type { Store } from 'solid-js/store'
import type { ProfilesState } from './types'
import type { ChannelType, PhaseSettings, PlanningMode, Profile, ProfileSettings, ProfileTarget, Scenario } from '~/types/profile'
import { batch, createContext, createEffect, createMemo, createRenderEffect, createSignal, on, onMount, useContext } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { useAuth } from '~/lib/auth'
import { clearDraftOAuthImport, loadDraftOAuthImport } from '~/lib/draft-oauth'
import { defaultSettings, DRAFT_PROFILE_ID } from '~/types/profile'
import { createProfileActions } from './actions/profile'
import { createSettingsActions } from './actions/settings'
import { createTargetActions } from './actions/targets'
import { createSync } from './sync'

interface ProfilesActions {
  // Profiles
  addProfile: (name: string, saveTargetsAndSettings?: (id: string) => Promise<void>) => Promise<string>
  renameProfile: (id: string, name: string) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  selectProfile: (id: string) => void

  // Targets
  addTarget: (target: { targetId: string, channelType: ChannelType }) => void
  removeTarget: (targetId: string) => void
  removeEntry: (id: string) => void
  incrementMindscape: (targetId: string) => void
  decrementMindscape: (targetId: string) => void
  reorderTargets: (fromIndex: number, toIndex: number) => void
  clearTargets: () => void

  // Settings
  setSettings: (updates: Partial<ProfileSettings>) => void
  setScenario: (scenario: Scenario) => void
  setPlanningMode: (mode: PlanningMode) => void

  // Phase Settings
  setPhaseSettings: (phaseRange: string, settings: Partial<PhaseSettings>) => void

  // Persistence
  promoteToPersisted: () => Promise<void>
  syncToServer: () => Promise<void>

  // Getters
  currentProfile: () => Profile
  currentSettings: () => ProfileSettings
  currentPhaseSettings: () => Record<string, PhaseSettings>
  isServerMode: () => boolean
}

type ProfilesStoreContextType = [Store<ProfilesState>, ProfilesActions]

const ProfilesStoreContext = createContext<ProfilesStoreContextType>()

interface ProfilesStoreProviderProps extends ParentProps {
  serverProfiles: Accessor<Profile[] | undefined>
}

export function ProfilesStoreProvider(props: ProfilesStoreProviderProps) {
  const auth = useAuth()
  const [pendingOAuthImport, setPendingOAuthImport] = createSignal<{ name?: string, targets: ProfileTarget[] } | null>(null)

  const [state, setState] = createStore<ProfilesState>({
    profiles: [],
    currentProfileId: DRAFT_PROFILE_ID,
    loading: false,
    fetchingProfiles: false,
    draft: {
      name: 'My Plan',
      targets: [],
      settings: defaultSettings(),
      phaseSettings: {},
    },
  })

  const isServerMode = createMemo(() => !!auth.session()?.user)

  // Data is loaded at route level and passed in
  const serverProfiles = createMemo(() => props.serverProfiles() ?? [])
  const selectedProfile = createMemo(() =>
    state.profiles.find(p => p.id === state.currentProfileId) ?? null,
  )

  // eslint-disable-next-line solid/reactivity
  const sync = createSync(selectedProfile, isServerMode)
  // eslint-disable-next-line solid/reactivity
  const profileActions = createProfileActions(state, setState, auth, isServerMode)
  const targetActions = createTargetActions(state, setState, sync.scheduleDebouncedSync)
  const settingsActions = createSettingsActions(state, setState, sync.scheduleDebouncedSync)

  // SSR + hydration: sync server profiles into store
  createRenderEffect(() => {
    if (!isServerMode())
      return

    if (sync.syncInProgress())
      return

    const data = serverProfiles()
    if (!data)
      return

    batch(() => {
      setState('fetchingProfiles', false)
      setState('profiles', reconcile(data))

      const currentId = state.currentProfileId
      const exists = currentId && data.find(p => p.id === currentId)

      if (!exists)
        setState('currentProfileId', data[0]?.id ?? DRAFT_PROFILE_ID)
    })
  })

  // Client-only: if logged in, show loading state until server query resolves
  createEffect(on(
    () => isServerMode(),
    (loggedIn) => {
      setState('fetchingProfiles', loggedIn)
    },
    { defer: true },
  ))

  // Client-only: read draft saved before OAuth redirect
  onMount(() => {
    const draft = loadDraftOAuthImport()
    if (draft)
      setPendingOAuthImport(draft)
  })

  // Auto-import draft after OAuth sign-in
  createEffect(on(
    () => [isServerMode(), pendingOAuthImport()] as const,
    async ([loggedIn, draft]) => {
      if (!loggedIn || !draft)
        return
      if (state.loading)
        return

      const { name, targets } = draft

      setState('loading', true)
      try {
        const profileName = (name && name.trim().length > 0) ? name.trim() : 'My Plan'

        await profileActions.addProfile(profileName, async (newId) => {
          if (targets.length > 0) {
            await sync.doSaveTargets({
              profileId: newId,
              targets,
            })
          }
        })

        setPendingOAuthImport(null)
        clearDraftOAuthImport()
      }
      finally {
        setState('loading', false)
      }
    },
  ))

  // When logged out, keep current plan as draft
  createEffect(on(
    () => isServerMode(),
    (loggedIn, prevLoggedIn) => {
      if (prevLoggedIn && !loggedIn) {
        const prev = selectedProfile()
        batch(() => {
          setState('profiles', [])
          setState('currentProfileId', DRAFT_PROFILE_ID)
          setState('draft', reconcile({
            name: prev?.name ?? 'My Plan',
            targets: prev?.targets ?? state.draft.targets,
            settings: prev?.settings ?? state.draft.settings,
            phaseSettings: prev?.phaseSettings ?? state.draft.phaseSettings,
          }))
        })
      }
    },
    { defer: true },
  ))

  const currentProfile = createMemo(() => {
    const selected = selectedProfile()
    if (selected)
      return selected
    return {
      id: DRAFT_PROFILE_ID,
      name: state.draft.name,
      targets: state.draft.targets,
      settings: state.draft.settings,
      phaseSettings: state.draft.phaseSettings,
    } satisfies Profile
  })

  // Reactive accessors for settings - these properly track store changes
  const currentSettings = () => {
    const profileIndex = state.profiles.findIndex(p => p.id === state.currentProfileId)
    if (profileIndex !== -1)
      return state.profiles[profileIndex].settings
    return state.draft.settings
  }

  const currentPhaseSettings = () => {
    const profileIndex = state.profiles.findIndex(p => p.id === state.currentProfileId)
    if (profileIndex !== -1)
      return state.profiles[profileIndex].phaseSettings
    return state.draft.phaseSettings
  }

  const actions: ProfilesActions = {
    ...profileActions,
    ...targetActions,
    ...settingsActions,

    syncToServer: sync.doSync,
    currentProfile: () => currentProfile(),
    currentSettings,
    currentPhaseSettings,
    isServerMode: () => isServerMode(),
  }

  return (
    <ProfilesStoreContext.Provider value={[state, actions]}>
      {props.children}
    </ProfilesStoreContext.Provider>
  )
}

export function useProfilesStore() {
  const ctx = useContext(ProfilesStoreContext)
  if (!ctx)
    throw new Error('useProfilesStore must be used within a ProfilesStoreProvider')

  return ctx
}
