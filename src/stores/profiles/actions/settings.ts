import type { SetStoreFunction } from 'solid-js/store'
import type { ProfilesState } from '../types'
import type { PhaseSettings, PlanningMode, ProfileSettings, Scenario } from '~/types/profile'

export function createSettingsActions(
  state: ProfilesState,
  setState: SetStoreFunction<ProfilesState>,
  scheduleSync: () => void,
) {
  function updateCurrentSettings(updater: (settings: ProfileSettings) => ProfileSettings) {
    const profileIndex = state.profiles.findIndex(p => p.id === state.currentProfileId)
    if (profileIndex === -1) {
      setState('draft', 'settings', s => updater({ ...s }))
      return
    }
    setState('profiles', profileIndex, 'settings', s => updater({ ...s }))
  }

  function updateCurrentPhaseSettings(phaseRange: string, updates: Partial<PhaseSettings>) {
    const profileIndex = state.profiles.findIndex(p => p.id === state.currentProfileId)
    if (profileIndex === -1) {
      setState('draft', 'phaseSettings', phaseRange, prev => ({ ...prev, ...updates } as PhaseSettings))
      return
    }
    setState('profiles', profileIndex, 'phaseSettings', phaseRange, prev => ({ ...prev, ...updates } as PhaseSettings))
  }

  return {
    // Settings
    setSettings: (updates: Partial<ProfileSettings>) => {
      updateCurrentSettings(s => ({ ...s, ...updates }))
      scheduleSync()
    },

    setScenario: (scenario: Scenario) => {
      updateCurrentSettings(s => ({ ...s, scenario }))
      scheduleSync()
    },

    setPlanningMode: (mode: PlanningMode) => {
      updateCurrentSettings(s => ({ ...s, planningMode: mode }))
      scheduleSync()
    },

    // Phase
    setPhaseSettings: (phaseRange: string, settings: Partial<PhaseSettings>) => {
      updateCurrentPhaseSettings(phaseRange, settings)
      scheduleSync()
    },
  }
}
