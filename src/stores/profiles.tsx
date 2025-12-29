import type { Accessor, ParentProps } from 'solid-js'
import type { Store } from 'solid-js/store'
import type { ChannelType } from '~/lib/constants'
import type { PlannerInputs, Scenario } from '~/lib/planner'
import type { DraftData, ProfileData, ProfileSettingsData } from '~/types/profile'
import { revalidate, useAction } from '@solidjs/router'
import { batch, createContext, createEffect, createMemo, createRenderEffect, createSignal, on, onCleanup, onMount, useContext } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { useAuth } from '~/lib/auth'
import { clearDraftOAuthImport, loadDraftOAuthImport } from '~/lib/draft-oauth'
import {
  createProfile as createProfileAction,
  deleteProfile as deleteProfileAction,
  getProfiles,
  promoteDraftToGuest,
  saveProfileSettings as saveProfileSettingsAction,
  saveProfileTargets as saveProfileTargetsAction,
  updateProfile as updateProfileAction,
} from '~/remote/profiles'

// #region Types
export interface ProfileTarget {
  targetId: string
  channelType: ChannelType
  count: number
  order: number
}

export interface Profile {
  id: string
  name: string
  targets: ProfileTarget[]
  settings: ProfileSettingsData
}

export interface ProfilesState {
  profiles: Profile[]
  currentProfileId: string
  loading: boolean
  fetchingProfiles: boolean
  draft: {
    name: string
    targets: ProfileTarget[]
    settings: ProfileSettingsData
  }
}
// #endregion

interface ProfilesActions {
  addProfile: (name: string) => Promise<string>
  renameProfile: (id: string, name: string) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  selectProfile: (id: string) => void

  addTarget: (target: { targetId: string, channelType: ChannelType }) => void
  removeTarget: (targetId: string) => void
  incrementMindscape: (targetId: string) => void
  decrementMindscape: (targetId: string) => void
  reorderTargets: (fromIndex: number, toIndex: number) => void
  clearTargets: () => void

  setPlannerInput: <K extends keyof PlannerInputs>(key: K, value: PlannerInputs[K]) => void
  setPlannerInputs: (updates: Partial<PlannerInputs>) => void
  setScenario: (scenario: Scenario) => void
  setPhaseTiming: (index: number, t: 'start' | 'end') => void
  setPlanningMode: (mode: 's-rank' | 'a-rank') => void

  promoteToPersisted: () => Promise<void>
  syncToServer: () => Promise<void>

  currentProfile: () => Profile
  isServerMode: () => boolean
}

type ProfilesStoreContextType = [Store<ProfilesState>, ProfilesActions]

const ProfilesStoreContext = createContext<ProfilesStoreContextType>()

// Debounce delay for syncing (ms)
const SYNC_DEBOUNCE_MS = 3000
const DRAFT_PROFILE_ID = '__draft__'

// #region Helpers
function normalizeTargets(targets: ProfileTarget[]): ProfileTarget[] {
  return targets.map((t, i) => ({ ...t, order: i }))
}

function defaultPlannerInputs(): PlannerInputs {
  return {
    N: 60,
    pullsOnHand: 0,
    incomes: [75, 75, 75, 75],
    pityAgentStart: 0,
    guaranteedAgentStart: false,
    pityEngineStart: 0,
    guaranteedEngineStart: false,
    luckMode: 'realistic',
  }
}

function defaultSettings(): ProfileSettingsData {
  return {
    plannerInputs: defaultPlannerInputs(),
    scenario: 'p60',
    phaseTimings: {},
    planningMode: 's-rank',
  }
}

function serverToLocalProfile(p: ProfileData): Profile {
  return {
    id: p.id,
    name: p.name ?? 'Profile',
    targets: (p.targets ?? []).map(t => ({
      targetId: t.targetId,
      channelType: t.channelType as ChannelType,
      count: t.count,
      order: t.order,
    })),
    settings: p.settings ?? defaultSettings(),
  }
}

function localToServerTargets(targets: ProfileTarget[]): DraftData['targets'] {
  return targets.map(t => ({
    targetId: t.targetId,
    channelType: t.channelType,
    count: t.count,
    order: t.order,
  }))
}
// #endregion

interface ProfilesStoreProviderProps extends ParentProps {
  serverProfiles: Accessor<ProfileData[] | undefined>
}

export function ProfilesStoreProvider(props: ProfilesStoreProviderProps) {
  const auth = useAuth()

  const doCreateProfile = useAction(createProfileAction)
  const doUpdateProfile = useAction(updateProfileAction)
  const doDeleteProfile = useAction(deleteProfileAction)
  const doSaveTargets = useAction(saveProfileTargetsAction)
  const doSaveSettings = useAction(saveProfileSettingsAction)
  const doPromoteDraft = useAction(promoteDraftToGuest)

  const [pendingOAuthImport, setPendingOAuthImport] = createSignal<{ name?: string, targets: ProfileTarget[] } | null>(null)
  const [syncInProgress, setSyncInProgress] = createSignal(false)

  const [state, setState] = createStore<ProfilesState>({
    profiles: [],
    currentProfileId: DRAFT_PROFILE_ID,
    loading: false,
    fetchingProfiles: false,
    draft: {
      name: 'My Plan',
      targets: [],
      settings: defaultSettings(),
    },
  })

  const isServerMode = createMemo(() => !!auth.session()?.user)

  // Data is loaded at route level and passed in - no createAsync here!
  const serverProfiles = () => props.serverProfiles() ?? []

  const selectedProfile = createMemo(() =>
    state.profiles.find(p => p.id === state.currentProfileId) ?? null,
  )

  // Important for SSR + hydration correctness:
  // - `createEffect` doesn't run on the server, so if we only sync async data into the store in an effect,
  //   SSR would render the "empty/draft" state while the client renders the real state.
  // - `createRenderEffect` runs during SSR rendering, so server + client start from the same store snapshot.
  createRenderEffect(() => {
    if (!isServerMode())
      return

    // Skip reconcile if we're in the middle of syncing - we have newer data locally
    if (syncInProgress())
      return

    // While the query is in flight, createAsync may return its initialValue.
    // That's OK: server+client will match, and it will update after hydration.
    const data = serverProfiles()
    if (!data)
      return

    const profiles = data.map(serverToLocalProfile)

    batch(() => {
      // When logged in, show spinner until we get a response (even if empty).
      setState('fetchingProfiles', false)
      setState('profiles', reconcile(profiles))

      const currentId = state.currentProfileId
      const exists = currentId && profiles.find(p => p.id === currentId)

      if (!exists)
        setState('currentProfileId', profiles[0]?.id ?? DRAFT_PROFILE_ID)
    })
  })

  // Client-only: if logged in, show loading state until the server query resolves.
  createEffect(on(
    () => isServerMode(),
    (loggedIn) => {
      setState('fetchingProfiles', loggedIn)
    },
    { defer: true },
  ))

  // Client-only: read any draft saved just before an OAuth redirect so we can import it after login.
  onMount(() => {
    const draft = loadDraftOAuthImport()
    if (draft)
      setPendingOAuthImport(draft)
  })

  // If the user completed OAuth sign-in while they had a draft, automatically import it into a new profile.
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
        // Always create a new profile to avoid accidentally overwriting existing profiles.
        const profileName = (name && name.trim().length > 0) ? name.trim() : 'My Plan'
        const id = await doCreateProfile({ name: profileName })
        if (targets.length > 0) {
          await doSaveTargets({
            profileId: id,
            targets: localToServerTargets(targets),
          })
        }
        await revalidate(getProfiles.key)
        setState('currentProfileId', id)

        // Clear the import only after a successful save.
        setPendingOAuthImport(null)
        clearDraftOAuthImport()
      }
      finally {
        setState('loading', false)
      }
    },
  ))

  // When auth state changes to logged-out, clear server profiles and keep the current plan as draft (in-memory)
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
    } satisfies Profile
  })

  function updateCurrentTargets(updater: (targets: ProfileTarget[]) => ProfileTarget[]) {
    const profileIndex = state.profiles.findIndex(p => p.id === state.currentProfileId)
    if (profileIndex === -1) {
      // Draft
      setState('draft', 'targets', targets => normalizeTargets(updater([...targets])))
      return
    }

    setState('profiles', profileIndex, 'targets', targets => normalizeTargets(updater([...targets])))
  }

  function updateCurrentSettings(updater: (settings: ProfileSettingsData) => ProfileSettingsData) {
    const profileIndex = state.profiles.findIndex(p => p.id === state.currentProfileId)
    if (profileIndex === -1) {
      // Draft
      setState('draft', 'settings', s => updater({ ...s }))
      return
    }
    setState('profiles', profileIndex, 'settings', s => updater({ ...s }))
  }

  // #region Debounced Sync
  let syncTimeoutId: ReturnType<typeof setTimeout> | null = null
  let hasPendingChanges = false

  async function doSync() {
    console.log('[ProfileSync] doSync called', { isServerMode: isServerMode(), profile: selectedProfile()?.id })
    if (!isServerMode()) {
      console.log('[ProfileSync] Skipped: not in server mode')
      return
    }
    const profile = selectedProfile()
    if (!profile) {
      console.log('[ProfileSync] Skipped: no selected profile')
      return
    }
    console.log('[ProfileSync] Syncing profile', profile.id, { settings: profile.settings })
    hasPendingChanges = false
    setSyncInProgress(true)
    try {
      await doSaveTargets({ profileId: profile.id, targets: localToServerTargets(profile.targets) })
      await doSaveSettings({ profileId: profile.id, settings: profile.settings })
      console.log('[ProfileSync] Sync complete!')
    }
    catch (err) {
      console.error('[ProfileSync] Sync failed:', err)
    }
    finally {
      setSyncInProgress(false)
    }
  }

  function scheduleDebouncedSync() {
    if (!isServerMode() || !selectedProfile())
      return
    hasPendingChanges = true
    if (syncTimeoutId)
      clearTimeout(syncTimeoutId)

    syncTimeoutId = setTimeout(() => {
      syncTimeoutId = null
      doSync()
    }, SYNC_DEBOUNCE_MS)
  }

  function flushSync() {
    if (!hasPendingChanges)
      return
    if (syncTimeoutId) {
      clearTimeout(syncTimeoutId)
      syncTimeoutId = null
    }
    doSync()
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden' && hasPendingChanges)
      flushSync()
  }

  function handleBeforeUnload() {
    // beforeunload fires on page refresh/close
    // flushSync() is async so we call it but can't wait for it
    // The browser may or may not complete the request
    if (hasPendingChanges)
      flushSync()
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('beforeunload', handleBeforeUnload)
    }
  })

  onCleanup(() => {
    flushSync()
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }

    if (syncTimeoutId)
      clearTimeout(syncTimeoutId)
  })
  // #endregion

  const actions: ProfilesActions = {
    // #region Profile
    addProfile: async (name: string) => {
      if (isServerMode()) {
        setState('loading', true)
        try {
          const id = await doCreateProfile({ name })

          // If the user has no profiles yet, treat this as "save draft into the first profile"
          // so planning remains seamless even if they started selecting targets before creating a profile.
          if (state.profiles.length === 0 && state.draft.targets.length > 0) {
            await doSaveTargets({
              profileId: id,
              targets: localToServerTargets(state.draft.targets),
            })
          }

          // Always persist draft settings into the first created profile (if any draft planning happened).
          if (state.profiles.length === 0) {
            await doSaveSettings({
              profileId: id,
              settings: state.draft.settings,
            })
          }

          await revalidate(getProfiles.key)
          setState('currentProfileId', id)

          // Clear draft after it has been persisted into a real profile
          setState('draft', reconcile({ name: 'My Plan', targets: [], settings: defaultSettings() }))
          return id
        }
        finally {
          setState('loading', false)
        }
      }
      else {
        // Logged out: creating the first profile should promote the draft to a guest session and persist it.
        setState('loading', true)
        try {
          const { profileId } = await doPromoteDraft({
            name,
            targets: localToServerTargets(state.draft.targets),
            settings: state.draft.settings,
          })

          await auth.refresh()
          await revalidate(getProfiles.key)

          setState('currentProfileId', profileId)
          setState('draft', reconcile({ name: 'My Plan', targets: [], settings: defaultSettings() }))
          return profileId
        }
        finally {
          setState('loading', false)
        }
      }
    },

    renameProfile: async (id: string, name: string) => {
      const trimmed = name.trim() || 'Untitled'

      if (isServerMode()) {
        setState('loading', true)
        try {
          await doUpdateProfile({ profileId: id, name: trimmed })
          await revalidate(getProfiles.key)
        }
        finally {
          setState('loading', false)
        }
      }
      else {
        const index = state.profiles.findIndex(p => p.id === id)
        if (index !== -1)
          setState('profiles', index, 'name', trimmed)
      }
    },

    deleteProfile: async (id: string) => {
      if (state.profiles.length <= 1)
        return

      if (isServerMode()) {
        setState('loading', true)
        try {
          await doDeleteProfile({ profileId: id })
          await revalidate(getProfiles.key)
          if (state.currentProfileId === id) {
            const remaining = state.profiles.filter(p => p.id !== id)
            setState('currentProfileId', remaining[0]?.id ?? DRAFT_PROFILE_ID)
          }
        }
        finally {
          setState('loading', false)
        }
      }
      else {
        const remaining = state.profiles.filter(p => p.id !== id)
        batch(() => {
          setState('profiles', remaining)
          if (state.currentProfileId === id)
            setState('currentProfileId', remaining[0]?.id ?? DRAFT_PROFILE_ID)
        })
      }
    },

    selectProfile: (id: string) => {
      if (state.profiles.some(p => p.id === id))
        setState('currentProfileId', id)
    },
    // #endregion

    // #region Target
    addTarget: (target) => {
      const profile = currentProfile()
      if (!profile)
        return
      if (profile.targets.some(t => t.targetId === target.targetId))
        return

      updateCurrentTargets(targets => [
        ...targets,
        { ...target, count: 1, order: targets.length },
      ])

      scheduleDebouncedSync()
    },

    removeTarget: (targetId: string) => {
      updateCurrentTargets(targets => targets.filter(t => t.targetId !== targetId))

      scheduleDebouncedSync()
    },

    incrementMindscape: (targetId: string) => {
      updateCurrentTargets((targets) => {
        const target = targets.find(t => t.targetId === targetId)
        if (!target)
          return targets

        const maxCount = target.channelType === 'agent' ? 7 : 6 // M0-M6 for agents, M0-M5 for engines
        if (target.count >= maxCount)
          return targets

        return targets.map(t =>
          t.targetId === targetId ? { ...t, count: t.count + 1 } : t,
        )
      })

      scheduleDebouncedSync()
    },

    decrementMindscape: (targetId: string) => {
      updateCurrentTargets((targets) => {
        const target = targets.find(t => t.targetId === targetId)
        if (!target)
          return targets

        if (target.count <= 1)
          return targets.filter(t => t.targetId !== targetId)

        return targets.map(t =>
          t.targetId === targetId ? { ...t, count: t.count - 1 } : t,
        )
      })

      scheduleDebouncedSync()
    },

    reorderTargets: (fromIndex: number, toIndex: number) => {
      updateCurrentTargets((targets) => {
        const sorted = [...targets].sort((a, b) => a.order - b.order)
        if (fromIndex < 0 || fromIndex >= sorted.length)
          return targets
        if (toIndex < 0 || toIndex >= sorted.length)
          return targets

        const [moved] = sorted.splice(fromIndex, 1)
        sorted.splice(toIndex, 0, moved)
        return sorted
      })

      scheduleDebouncedSync()
    },

    clearTargets: () => {
      updateCurrentTargets(() => [])

      scheduleDebouncedSync()
    },
    // #endregion

    // #region Planner Settings (profile-scoped)
    setPlannerInput: (key, value) => {
      updateCurrentSettings((s) => {
        return {
          ...s,
          plannerInputs: {
            ...(s.plannerInputs as PlannerInputs),
            [key]: value,
          } as any,
        }
      })
      scheduleDebouncedSync()
    },

    setPlannerInputs: (updates) => {
      updateCurrentSettings(s => ({
        ...s,
        plannerInputs: {
          ...(s.plannerInputs as PlannerInputs),
          ...(updates as any),
        },
      }))
      scheduleDebouncedSync()
    },

    setScenario: (scenario) => {
      updateCurrentSettings(s => ({ ...s, scenario }))
      scheduleDebouncedSync()
    },

    setPhaseTiming: (index, t) => {
      updateCurrentSettings(s => ({ ...s, phaseTimings: { ...(s.phaseTimings ?? {}), [index]: t } }))
      scheduleDebouncedSync()
    },

    setPlanningMode: (mode) => {
      updateCurrentSettings(s => ({ ...s, planningMode: mode }))
      scheduleDebouncedSync()
    },
    // #endregion

    // #region Persistence
    promoteToPersisted: async () => {
      if (isServerMode())
        throw new Error('Already logged in')

      setState('loading', true)
      try {
        const { profileId } = await doPromoteDraft({
          name: state.draft.name,
          targets: localToServerTargets(state.draft.targets),
          settings: state.draft.settings,
        })

        await auth.refresh()
        await revalidate(getProfiles.key)

        setState('currentProfileId', profileId)
        setState('draft', reconcile({ name: 'My Plan', targets: [], settings: defaultSettings() }))
      }
      finally {
        setState('loading', false)
      }
    },

    syncToServer: async () => {
      if (!isServerMode())
        return
      flushSync()
      await doSync()
    },
    // #endregion

    currentProfile: () => currentProfile(),
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
