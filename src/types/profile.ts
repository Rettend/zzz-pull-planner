export type Scenario = 'p50' | 'p60' | 'p75' | 'p90' | 'ev'
export type PlanningMode = 's-rank' | 'a-rank'
export type LuckMode = 'best' | 'realistic' | 'worst'
export type ChannelType = 'agent' | 'engine'

export interface ProfileTarget {
  id: string
  targetId: string
  channelType: ChannelType
  order: number
}

export interface ProfileSettings {
  pullsOnHand: number

  // S-Rank pity
  pityAgentS: number
  guaranteedAgentS: boolean
  pityEngineS: number
  guaranteedEngineS: boolean

  // A-Rank pity
  pityAgentA: number
  guaranteedAgentA: boolean
  pityEngineA: number
  guaranteedEngineA: boolean

  // Preferences
  scenario: Scenario
  planningMode: PlanningMode
  luckMode: LuckMode
}

export interface PhaseSettings {
  income: number
  timing: 'start' | 'end'
}

export type PlannerSettings = ProfileSettings & { phaseSettings: Record<string, PhaseSettings> }

export interface Profile {
  id: string
  name: string
  targets: ProfileTarget[]
  settings: ProfileSettings
  phaseSettings: Record<string, PhaseSettings> // keyed by phase_range
}

// Constants
export const SYNC_DEBOUNCE_MS = 3000
export const DRAFT_PROFILE_ID = '__draft__'

// Defaults
export function defaultSettings(): ProfileSettings {
  return {
    pullsOnHand: 0,
    pityAgentS: 0,
    guaranteedAgentS: false,
    pityEngineS: 0,
    guaranteedEngineS: false,
    pityAgentA: 0,
    guaranteedAgentA: false,
    pityEngineA: 0,
    guaranteedEngineA: false,
    scenario: 'p60',
    planningMode: 's-rank',
    luckMode: 'realistic',
  }
}

export function defaultPhaseSettings(): PhaseSettings {
  return {
    income: 75,
    timing: 'end',
  }
}
