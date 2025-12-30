import type { Accessor } from 'solid-js'
import type { Profile } from '~/types/profile'
import { useAction } from '@solidjs/router'
import { createSignal, onCleanup, onMount } from 'solid-js'
import {
  saveProfilePhaseSettings as saveProfilePhaseSettingsAction,
  saveProfileSettings as saveProfileSettingsAction,
  saveProfileTargets as saveProfileTargetsAction,
} from '~/remote/profiles'
import { SYNC_DEBOUNCE_MS } from '~/types/profile'

export function createSync(
  selectedProfile: Accessor<Profile | null | undefined>,
  isServerMode: () => boolean,
) {
  const doSaveTargets = useAction(saveProfileTargetsAction)
  const doSaveSettings = useAction(saveProfileSettingsAction)
  const doSavePhaseSettings = useAction(saveProfilePhaseSettingsAction)

  const [syncInProgress, setSyncInProgress] = createSignal(false)
  let syncTimeoutId: ReturnType<typeof setTimeout> | null = null
  let hasPendingChanges = false

  async function doSync() {
    if (!isServerMode())
      return
    const profile = selectedProfile()
    if (!profile)
      return

    hasPendingChanges = false
    setSyncInProgress(true)
    try {
      await Promise.all([
        doSaveTargets({ profileId: profile.id, targets: profile.targets }),
        doSaveSettings({ profileId: profile.id, settings: profile.settings }),
        doSavePhaseSettings({ profileId: profile.id, phaseSettings: profile.phaseSettings }),
      ])
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

  return {
    syncInProgress,
    scheduleDebouncedSync,
    doSync: async () => {
      flushSync()
      await doSync()
    },
    // Initial create in profiles/index.tsx uses these directly
    doSaveTargets,
    doSaveSettings,
  }
}
