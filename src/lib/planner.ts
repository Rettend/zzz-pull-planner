import type { Banner, ChannelType } from '~/lib/constants'
import { convolveDiscrete, costAtScenario, costStatsFromPmf, featuredCostPmf, geometricCostPmf, getARankHazard } from '~/lib/probability'

export type Scenario = 'p50' | 'p60' | 'p75' | 'p90' | 'ev'

export interface PlannerInputs {
  N: number
  pullsOnHand: number
  incomes: number[] // Index corresponds to phase index (0 -> Phase 1, etc.)
  pityAgentStart: number
  guaranteedAgentStart: boolean
  pityEngineStart: number
  guaranteedEngineStart: boolean
  luckMode?: 'best' | 'realistic' | 'worst'
}

export interface PhaseResult {
  id: string // range key
  index: number // 0-based index
  agentCost: number
  engineCost: number
  reserveForNextPhase: number
  startBudget: number
  endBudget: number
  engineSpendStart: number
  engineSpendEnd: number
  carryToNextPhaseStart: number
  carryToNextPhaseEnd: number
  canAffordAgentStart: boolean
  canAffordAgentEnd: boolean
  canAffordEngineStart: boolean
  canAffordEngineEnd: boolean
  successProbStart?: number
  successProbEnd?: number
  shortfallStart?: number
  shortfallEnd?: number

  // State at the end of this phase
  agentPityEnd: number
  agentGuaranteedEnd: boolean
  enginePityEnd: number
  engineGuaranteedEnd: boolean

  boughtAgents: number
  boughtEngines: number
  boughtNames: string[]
  itemDetails: {
    name: string
    channel: ChannelType
    cost: number
    funded: boolean
    rarity: number
  }[]
}

export interface PhasePlan {
  phases: PhaseResult[]
  totals: {
    agentsGot: number
    enginesGot: number
    pullsLeftEnd: number
  }
  fundedTargets: string[]
}

export function emptyPlan(): PhasePlan {
  return {
    phases: [],
    totals: { agentsGot: 0, enginesGot: 0, pullsLeftEnd: 0 },
    fundedTargets: [],
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function costToFeaturedAgent(
  pity: number,
  guaranteed: boolean,
  qAgent: number,
  scenario: Scenario,
): number {
  const pmf = featuredCostPmf('agent', pity, guaranteed, qAgent)
  const stats = costStatsFromPmf(pmf)
  return costAtScenario(scenario, stats)
}

export function costToFeaturedEngine(
  pity: number,
  guaranteed: boolean,
  qEngine: number,
  scenario: Scenario,
): number {
  const pmf = featuredCostPmf('engine', pity, guaranteed, qEngine)
  const stats = costStatsFromPmf(pmf)
  return costAtScenario(scenario, stats)
}

export function costToFeaturedARank(
  channel: ChannelType,
  scenario: Scenario,
  luckMode: 'best' | 'realistic' | 'worst' = 'realistic',
  pity = 0,
  guaranteed = false,
): number {
  // A-Rank Logic:
  // Agent: 9.4% Base, 50% Featured (2 specific -> 25% specific)
  // Engine: 15% Base, 50% Featured (2 specific -> 25% specific)

  const baseRate = channel === 'agent' ? 0.094 : 0.150
  const winRate = 0.25 // 25% chance for specific featured A-rank

  // Adjust 'pSuccess' based on luckMode
  // Base success rate for specific featured is 0.25 (approx)
  // We model this as geometric trials.
  let pSuccess = winRate
  if (guaranteed)
    pSuccess = 0.5

  if (luckMode === 'best')
    pSuccess = 1.0 // Get it first try
  if (luckMode === 'worst')
    pSuccess = 0.10 // Very unlucky (10 trials avg)

  const { hazards } = getARankHazard(baseRate)

  const pmf = geometricCostPmf(hazards, pSuccess, 0.999, pity)
  const stats = costStatsFromPmf(pmf)

  return costAtScenario(scenario, stats)
}

interface SelectedTargetInput { name: string, channel: ChannelType }

function rangeKey(b: Banner): string {
  return `${b.start}→${b.end}`
}

export function computePhaseRanges(banners: Banner[]): string[] {
  const ranges = Array.from(new Set(banners.map(rangeKey)))
  ranges.sort((a, b) => a.localeCompare(b))
  return ranges
}

export function computePlan(
  banners: Banner[],
  inputs: PlannerInputs,
  scenario: Scenario,
  selected: SelectedTargetInput[] = [],
): PhasePlan {
  const {
    pullsOnHand: rawPullsOnHand,
    incomes: rawIncomes = [],
    pityAgentStart,
    guaranteedAgentStart,
    pityEngineStart,
    guaranteedEngineStart,
    luckMode = 'realistic',
  } = inputs

  const pullsOnHand = Number(rawPullsOnHand)
  const incomes = (rawIncomes || []).map(Number)

  const qAgent = luckMode === 'best' ? 1 : luckMode === 'worst' ? 0 : 0.5
  const qEngine = luckMode === 'best' ? 1 : luckMode === 'worst' ? 0 : 0.75

  const ranges = computePhaseRanges(banners)

  const bannerMap = new Map<string, Banner>()
  const rarityMap = new Map<string, number>() // 5 for S, 4 for A

  for (const b of banners) {
    bannerMap.set(b.featured, b)
    rarityMap.set(b.featured, 5)
    for (const a of b.featuredARanks) {
      // For A-ranks, always update to use the latest banner
      bannerMap.set(a, b)
      rarityMap.set(a, 4)
    }
  }

  const targetsByPhase: SelectedTargetInput[][] = ranges.map(() => [])

  for (const t of selected) {
    const b = bannerMap.get(t.name)
    let phaseIdx = 0
    if (b) {
      const idx = ranges.indexOf(rangeKey(b))
      if (idx >= 0)
        phaseIdx = idx
    }

    // Guard against no phases available
    if (targetsByPhase.length === 0)
      continue

    // If banner not found, default to phase 0 (current)
    if (targetsByPhase[phaseIdx]) {
      targetsByPhase[phaseIdx].push(t)
    }
    else {
      // Fallback to first phase if specific phase not found (should be covered by phaseIdx=0 but being safe)
      targetsByPhase[0]?.push(t)
    }
  }

  const globalIndexByName: Record<string, number> = {}
  for (let i = 0; i < selected.length; i++) {
    const t = selected[i]
    if (globalIndexByName[t.name] === undefined)
      globalIndexByName[t.name] = i
  }

  // Helper to calculate reserve needed for future phases
  function reserveForFuture(
    currentPhaseIndex: number,
    currentAgentState: { pity: number, guaranteed: boolean },
    currentEngineState: { pity: number, guaranteed: boolean },
    limitGlobalIndexExclusive: number = Number.POSITIVE_INFINITY,
  ): number {
    let reserve = 0
    const stAgent = { ...currentAgentState }
    const stEngine = { ...currentEngineState }

    // Iterate through all future phases
    for (let i = currentPhaseIndex + 1; i < targetsByPhase.length; i++) {
      const targets = targetsByPhase[i]
      for (const t of targets) {
        const gIdx = globalIndexByName[t.name]
        if (gIdx === undefined || gIdx >= limitGlobalIndexExclusive)
          continue

        const rarity = rarityMap.get(t.name) ?? 5
        let c = 0

        if (rarity === 4) {
          // A-Rank cost
          const state = t.channel === 'agent' ? stAgent : stEngine
          c = costToFeaturedARank(t.channel, scenario, luckMode, state.pity, state.guaranteed)
        }
        else {
          // S-Rank cost
          if (t.channel === 'agent') {
            c = costToFeaturedAgent(stAgent.pity, stAgent.guaranteed, qAgent, scenario)
            stAgent.pity = 0
            stAgent.guaranteed = false
          }
          else {
            c = costToFeaturedEngine(stEngine.pity, stEngine.guaranteed, qEngine, scenario)
            stEngine.pity = 0
            stEngine.guaranteed = false
          }
        }

        reserve += Math.max(0, c)
      }
    }
    return reserve
  }

  function phaseSuccessProb(
    budget: number,
    targetsInPhase: SelectedTargetInput[],
    agentStateIn: { pity: number, guaranteed: boolean },
    engineStateIn: { pity: number, guaranteed: boolean },
  ): number {
    let pmfTotal: number[] = [1]
    const agentState = { ...agentStateIn }
    const engineState = { ...engineStateIn }
    for (const t of targetsInPhase) {
      const rarity = rarityMap.get(t.name) ?? 5
      let pmf: number[]

      if (rarity === 4) {
        // A-Rank Logic
        const baseRate = t.channel === 'agent' ? 0.094 : 0.150
        const winRate = 0.25
        let pSuccess = winRate

        const state = t.channel === 'agent' ? agentState : engineState
        if (state.guaranteed) {
          pSuccess = 0.5
        }

        if (luckMode === 'best')
          pSuccess = 1.0
        if (luckMode === 'worst')
          pSuccess = 0.10

        const { hazards } = getARankHazard(baseRate)
        pmf = geometricCostPmf(hazards, pSuccess, 0.999, state.pity)
      }
      else {
        // S-Rank Logic
        pmf = t.channel === 'agent'
          ? featuredCostPmf('agent', agentState.pity, agentState.guaranteed, qAgent)
          : featuredCostPmf('engine', engineState.pity, engineState.guaranteed, qEngine)

        if (t.channel === 'agent') {
          agentState.pity = 0
          agentState.guaranteed = false
        }
        else {
          engineState.pity = 0
          engineState.guaranteed = false
        }
      }

      pmfTotal = convolveDiscrete(pmfTotal, pmf)
    }
    const b = Math.max(0, Math.floor(budget))
    let acc = 0
    for (let i = 0; i < pmfTotal.length && i + 1 <= b; i++) acc += pmfTotal[i]
    return Math.max(0, Math.min(1, acc))
  }

  const phases: PhaseResult[] = []
  let currentAgentState = { pity: clamp(pityAgentStart, 0, 89), guaranteed: Boolean(guaranteedAgentStart) }
  let currentEngineState = { pity: clamp(pityEngineStart, 0, 79), guaranteed: Boolean(guaranteedEngineStart) }

  // Track budget flow
  // Start of Phase 0 is pullsOnHand.
  // End of Phase 0 is Start + Income[0].
  // Start of Phase 1 is End of Phase 0.
  // End of Phase 1 is Start + Income[1].

  let previousPhaseCarryEnd = pullsOnHand // Will be updated in loop

  let totalAgentsGot = 0
  let totalEnginesGot = 0
  const allFundedTargets: string[] = []

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]
    const targets = targetsByPhase[i]
    const income = incomes[i] ?? 0

    // Budget for this phase
    // Phase[i] Start Budget = (i==0) ? PullsOnHand : Phase[i-1].carryToNextPhaseEnd
    // Phase[i] End Budget = Phase[i] Start Budget + Income[i]

    const startBudget = (i === 0) ? pullsOnHand : previousPhaseCarryEnd
    const endBudget = startBudget + income

    // Simulate spending in this phase
    let remainingStart = startBudget
    let remainingEnd = endBudget

    const agentStateSim = { ...currentAgentState }
    const engineStateSim = { ...currentEngineState }

    let spentAgents = 0
    let spentEngines = 0
    let boughtAgents = 0
    let boughtEngines = 0
    const boughtNames: string[] = []
    const itemDetails: PhaseResult['itemDetails'] = []
    let shortfallStart: number | undefined
    let shortfallEnd: number | undefined

    for (const t of targets) {
      const isAgent = t.channel === 'agent'
      const rarity = rarityMap.get(t.name) ?? 5

      let cost = 0
      if (rarity === 4) {
        const state = isAgent ? agentStateSim : engineStateSim
        cost = costToFeaturedARank(t.channel, scenario, luckMode, state.pity, state.guaranteed)
      }
      else {
        cost = isAgent
          ? costToFeaturedAgent(agentStateSim.pity, agentStateSim.guaranteed, qAgent, scenario)
          : costToFeaturedEngine(engineStateSim.pity, engineStateSim.guaranteed, qEngine, scenario)
      }

      const nextAgentState = { ...agentStateSim }
      const nextEngineState = { ...engineStateSim }

      if (isAgent) {
        nextAgentState.pity = 0
        nextAgentState.guaranteed = false
      }
      else {
        nextEngineState.pity = 0
        nextEngineState.guaranteed = false
      }

      const currentGlobalIndex = globalIndexByName[t.name] ?? Number.POSITIVE_INFINITY

      const newRemainingEnd = remainingEnd - cost
      const newRemainingStart = remainingStart - cost

      const reserveAfter = reserveForFuture(i, nextAgentState, nextEngineState, currentGlobalIndex)

      const affordableEnd = newRemainingEnd >= reserveAfter
      const affordableStart = newRemainingStart >= reserveAfter

      const funded = affordableEnd

      if (funded) {
        remainingEnd = newRemainingEnd
        if (affordableStart) {
          remainingStart = newRemainingStart
        }

        if (isAgent) {
          spentAgents += cost
          boughtAgents += 1
          boughtNames.push(t.name)
        }
        else {
          spentEngines += cost
          boughtEngines += 1
          boughtNames.push(t.name)
        }
      }
      else {
        shortfallEnd = Math.max(shortfallEnd ?? 0, reserveAfter - newRemainingEnd)
        shortfallStart = Math.max(shortfallStart ?? 0, reserveAfter - newRemainingStart)
      }

      if (isAgent) {
        agentStateSim.pity = nextAgentState.pity
        agentStateSim.guaranteed = nextAgentState.guaranteed
        if (rarity === 4) {
          agentStateSim.pity = 0
          agentStateSim.guaranteed = false
        }
      }
      else {
        engineStateSim.pity = nextEngineState.pity
        engineStateSim.guaranteed = nextEngineState.guaranteed
        if (rarity === 4) {
          engineStateSim.pity = 0
          engineStateSim.guaranteed = false
        }
      }

      itemDetails.push({
        name: t.name,
        channel: t.channel,
        cost,
        funded,
        rarity,
      })
    }

    const reserveNext = reserveForFuture(i, agentStateSim, engineStateSim, Number.POSITIVE_INFINITY)

    const totalPhaseAgents = targets.filter(t => t.channel === 'agent').length
    const totalPhaseEngines = targets.filter(t => t.channel === 'engine').length

    const successProbStart = phaseSuccessProb(startBudget, targets, currentAgentState, currentEngineState)
    const successProbEnd = phaseSuccessProb(endBudget, targets, currentAgentState, currentEngineState)

    currentAgentState = agentStateSim
    currentEngineState = engineStateSim
    previousPhaseCarryEnd = Math.max(0, remainingEnd)

    totalAgentsGot += boughtAgents
    totalEnginesGot += boughtEngines
    allFundedTargets.push(...boughtNames)

    phases.push({
      id: range,
      index: i,
      agentCost: Math.max(0, spentAgents),
      engineCost: Math.max(0, spentEngines),
      reserveForNextPhase: Math.max(0, reserveNext),
      startBudget: Math.max(0, startBudget),
      endBudget: Math.max(0, endBudget),
      engineSpendStart: Math.max(0, spentEngines),
      engineSpendEnd: Math.max(0, spentEngines),
      carryToNextPhaseStart: Math.max(0, remainingStart),
      carryToNextPhaseEnd: Math.max(0, remainingEnd),
      canAffordAgentStart: (boughtAgents === totalPhaseAgents) && (spentAgents <= startBudget),
      canAffordAgentEnd: (boughtAgents === totalPhaseAgents),
      canAffordEngineStart: (boughtEngines === totalPhaseEngines) && (spentEngines <= startBudget),
      canAffordEngineEnd: (boughtEngines === totalPhaseEngines),
      successProbStart,
      successProbEnd,
      shortfallStart: Math.max(0, shortfallStart ?? 0),
      shortfallEnd: Math.max(0, shortfallEnd ?? 0),
      agentPityEnd: agentStateSim.pity,
      agentGuaranteedEnd: agentStateSim.guaranteed,
      enginePityEnd: engineStateSim.pity,
      engineGuaranteedEnd: engineStateSim.guaranteed,
      boughtAgents,
      boughtEngines,
      boughtNames,
      itemDetails,
    })
  }

  return {
    phases,
    totals: {
      agentsGot: totalAgentsGot,
      enginesGot: totalEnginesGot,
      pullsLeftEnd: Math.max(0, previousPhaseCarryEnd),
    },
    fundedTargets: allFundedTargets,
  }
}
