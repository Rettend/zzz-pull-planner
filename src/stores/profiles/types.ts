import type { PhaseSettings, Profile, ProfileSettings, ProfileTarget } from '~/types/profile'

export type { PhaseSettings, Profile, ProfileSettings, ProfileTarget }

export interface ProfilesState {
  profiles: Profile[]
  currentProfileId: string
  loading: boolean
  fetchingProfiles: boolean
  draft: {
    name: string
    targets: ProfileTarget[]
    settings: ProfileSettings
    phaseSettings: Record<string, PhaseSettings>
  }
}
