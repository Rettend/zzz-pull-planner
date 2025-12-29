import type { SetStoreFunction } from 'solid-js/store'
import type { ProfilesState } from '../types'
import type { useAuth } from '~/lib/auth'
import { revalidate, useAction } from '@solidjs/router'
import { batch } from 'solid-js'
import { reconcile } from 'solid-js/store'
import {
  createProfile as createProfileAction,
  deleteProfile as deleteProfileAction,
  getProfiles,
  promoteDraftToGuest,
  updateProfile as updateProfileAction,
} from '~/remote/profiles'
import { defaultSettings, DRAFT_PROFILE_ID } from '~/types/profile'

export function createProfileActions(
  state: ProfilesState,
  setState: SetStoreFunction<ProfilesState>,
  auth: ReturnType<typeof useAuth>,
  isServerMode: () => boolean,
) {
  const doCreateProfile = useAction(createProfileAction)
  const doUpdateProfile = useAction(updateProfileAction)
  const doDeleteProfile = useAction(deleteProfileAction)
  const doPromoteDraft = useAction(promoteDraftToGuest)

  return {
    addProfile: async (name: string, saveTargetsAndSettings?: (id: string) => Promise<void>) => {
      if (isServerMode()) {
        setState('loading', true)
        try {
          const id = await doCreateProfile({ name })

          // If callback provided (e.g. for saving draft data to new profile), run it
          if (saveTargetsAndSettings)
            await saveTargetsAndSettings(id)

          await revalidate(getProfiles.key)
          setState('currentProfileId', id)
          setState('draft', reconcile({ name: 'My Plan', targets: [], settings: defaultSettings(), phaseSettings: {} }))
          return id
        }
        finally {
          setState('loading', false)
        }
      }
      else {
        // Promote draft to guest session
        setState('loading', true)
        try {
          const { profileId } = await doPromoteDraft({
            name,
            targets: state.draft.targets,
            settings: state.draft.settings,
            phaseSettings: state.draft.phaseSettings,
          })

          await auth.refresh()
          await revalidate(getProfiles.key)

          setState('currentProfileId', profileId)
          setState('draft', reconcile({ name: 'My Plan', targets: [], settings: defaultSettings(), phaseSettings: {} }))
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

    promoteToPersisted: async () => {
      if (isServerMode())
        throw new Error('Already logged in')

      setState('loading', true)
      try {
        const { profileId } = await doPromoteDraft({
          name: state.draft.name,
          targets: state.draft.targets,
          settings: state.draft.settings,
          phaseSettings: state.draft.phaseSettings,
        })

        await auth.refresh()
        await revalidate(getProfiles.key)

        setState('currentProfileId', profileId)
        setState('draft', reconcile({ name: 'My Plan', targets: [], settings: defaultSettings(), phaseSettings: {} }))
      }
      finally {
        setState('loading', false)
      }
    },
  }
}
