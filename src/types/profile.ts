export interface ProfileTargetData {
  targetId: string
  channelType: 'agent' | 'engine'
  count: number
  order: number
}

export type Scenario = 'p50' | 'p60' | 'p75' | 'p90' | 'ev'

export type PlanningMode = 's-rank' | 'a-rank'

export interface PlannerInputsData {
  N: number
  pullsOnHand: number
  incomes: number[]
  pityAgentStart: number
  guaranteedAgentStart: boolean
  pityEngineStart: number
  guaranteedEngineStart: boolean
  pityAgentStartA?: number
  guaranteedAgentStartA?: boolean
  pityEngineStartA?: number
  guaranteedEngineStartA?: boolean
  luckMode?: 'best' | 'realistic' | 'worst'
}

export interface ProfileSettingsData {
  plannerInputs: PlannerInputsData
  scenario: Scenario
  phaseTimings: Record<number, 'start' | 'end'>
  planningMode: PlanningMode
}

export interface DraftData {
  name?: string
  targets: ProfileTargetData[]
  settings?: ProfileSettingsData
}

export interface ProfileData {
  id: string
  name: string
  targets: ProfileTargetData[]
  settings: ProfileSettingsData
}
