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
  pityAgentStartA?: number
  guaranteedAgentStartA?: boolean
  pityEngineStartA?: number
  guaranteedEngineStartA?: boolean
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
  agentPityEndA: number
  agentGuaranteedEndA: boolean
  enginePityEndA: number
  engineGuaranteedEndA: boolean

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
  // Engine: 15% Base, 75% Featured (2 specific -> 37.5% specific)

  const baseRate = channel === 'agent' ? 0.094 : 0.150
  const winRate = channel === 'agent' ? 0.25 : 0.375

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
    currentAgentStateS: { pity: number, guaranteed: boolean },
    currentEngineStateS: { pity: number, guaranteed: boolean },
    currentAgentStateA: { pity: number, guaranteed: boolean },
    currentEngineStateA: { pity: number, guaranteed: boolean },
    limitGlobalIndexExclusive: number = Number.POSITIVE_INFINITY,
  ): number {
    let reserve = 0
    const stAgentS = { ...currentAgentStateS }
    const stEngineS = { ...currentEngineStateS }
    const stAgentA = { ...currentAgentStateA }
    const stEngineA = { ...currentEngineStateA }

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
          const state = t.channel === 'agent' ? stAgentA : stEngineA
          c = costToFeaturedARank(t.channel, scenario, luckMode, state.pity, state.guaranteed)
          // Update A-rank state
          if (t.channel === 'agent') {
            stAgentA.pity = 0
            stAgentA.guaranteed = false
          }
          else {
            stEngineA.pity = 0
            stEngineA.guaranteed = false
          }
        }
        else {
          // S-Rank cost
          if (t.channel === 'agent') {
            c = costToFeaturedAgent(stAgentS.pity, stAgentS.guaranteed, qAgent, scenario)
            stAgentS.pity = 0
            stAgentS.guaranteed = false
          }
          else {
            c = costToFeaturedEngine(stEngineS.pity, stEngineS.guaranteed, qEngine, scenario)
            stEngineS.pity = 0
            stEngineS.guaranteed = false
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
    agentStateInS: { pity: number, guaranteed: boolean },
    engineStateInS: { pity: number, guaranteed: boolean },
    agentStateInA: { pity: number, guaranteed: boolean },
    engineStateInA: { pity: number, guaranteed: boolean },
  ): number {
    let pmfTotal: number[] = [1]
    const agentStateS = { ...agentStateInS }
    const engineStateS = { ...engineStateInS }
    const agentStateA = { ...agentStateInA }
    const engineStateA = { ...engineStateInA }

    for (const t of targetsInPhase) {
      const rarity = rarityMap.get(t.name) ?? 5
      let pmf: number[]

      if (rarity === 4) {
        // A-Rank Logic
        const baseRate = t.channel === 'agent' ? 0.094 : 0.150
        const winRate = 0.25
        let pSuccess = winRate

        const state = t.channel === 'agent' ? agentStateA : engineStateA
        if (state.guaranteed) {
          pSuccess = 0.5
        }

        if (luckMode === 'best')
          pSuccess = 1.0
        if (luckMode === 'worst')
          pSuccess = 0.10

        const { hazards } = getARankHazard(baseRate)
        pmf = geometricCostPmf(hazards, pSuccess, 0.999, state.pity)

        // Update state
        if (t.channel === 'agent') {
          agentStateA.pity = 0
          agentStateA.guaranteed = false
        }
        else {
          engineStateA.pity = 0
          engineStateA.guaranteed = false
        }
      }
      else {
        // S-Rank Logic
        pmf = t.channel === 'agent'
          ? featuredCostPmf('agent', agentStateS.pity, agentStateS.guaranteed, qAgent)
          : featuredCostPmf('engine', engineStateS.pity, engineStateS.guaranteed, qEngine)

        if (t.channel === 'agent') {
          agentStateS.pity = 0
          agentStateS.guaranteed = false
        }
        else {
          engineStateS.pity = 0
          engineStateS.guaranteed = false
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
  let currentAgentStateS = { pity: clamp(pityAgentStart, 0, 89), guaranteed: Boolean(guaranteedAgentStart) }
  let currentEngineStateS = { pity: clamp(pityEngineStart, 0, 79), guaranteed: Boolean(guaranteedEngineStart) }
  let currentAgentStateA = { pity: clamp(inputs.pityAgentStartA ?? 0, 0, 9), guaranteed: Boolean(inputs.guaranteedAgentStartA) }
  let currentEngineStateA = { pity: clamp(inputs.pityEngineStartA ?? 0, 0, 9), guaranteed: Boolean(inputs.guaranteedEngineStartA) }

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

    const agentStateSimS = { ...currentAgentStateS }
    const engineStateSimS = { ...currentEngineStateS }
    const agentStateSimA = { ...currentAgentStateA }
    const engineStateSimA = { ...currentEngineStateA }

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
        const state = isAgent ? agentStateSimA : engineStateSimA
        cost = costToFeaturedARank(t.channel, scenario, luckMode, state.pity, state.guaranteed)
      }
      else {
        cost = isAgent
          ? costToFeaturedAgent(agentStateSimS.pity, agentStateSimS.guaranteed, qAgent, scenario)
          : costToFeaturedEngine(engineStateSimS.pity, engineStateSimS.guaranteed, qEngine, scenario)
      }

      const nextAgentStateS = { ...agentStateSimS }
      const nextEngineStateS = { ...engineStateSimS }
      const nextAgentStateA = { ...agentStateSimA }
      const nextEngineStateA = { ...engineStateSimA }

      if (rarity === 4) {
        if (isAgent) {
          nextAgentStateA.pity = 0
          nextAgentStateA.guaranteed = false
        }
        else {
          nextEngineStateA.pity = 0
          nextEngineStateA.guaranteed = false
        }
      }
      else {
        if (isAgent) {
          nextAgentStateS.pity = 0
          nextAgentStateS.guaranteed = false
        }
        else {
          nextEngineStateS.pity = 0
          nextEngineStateS.guaranteed = false
        }
      }

      const currentGlobalIndex = globalIndexByName[t.name] ?? Number.POSITIVE_INFINITY

      const newRemainingEnd = remainingEnd - cost
      const newRemainingStart = remainingStart - cost

      const reserveAfter = reserveForFuture(
        i,
        nextAgentStateS,
        nextEngineStateS,
        nextAgentStateA,
        nextEngineStateA,
        currentGlobalIndex,
      )

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

      // Update the Sim states for the next target in this phase
      if (rarity === 4) {
        if (isAgent) {
          agentStateSimA.pity = nextAgentStateA.pity
          agentStateSimA.guaranteed = nextAgentStateA.guaranteed
        }
        else {
          engineStateSimA.pity = nextEngineStateA.pity
          engineStateSimA.guaranteed = nextEngineStateA.guaranteed
        }
      }
      else {
        if (isAgent) {
          agentStateSimS.pity = nextAgentStateS.pity
          agentStateSimS.guaranteed = nextAgentStateS.guaranteed
        }
        else {
          engineStateSimS.pity = nextEngineStateS.pity
          engineStateSimS.guaranteed = nextEngineStateS.guaranteed
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

    const reserveNext = reserveForFuture(
      i,
      agentStateSimS,
      engineStateSimS,
      agentStateSimA,
      engineStateSimA,
      Number.POSITIVE_INFINITY,
    )

    const totalPhaseAgents = targets.filter(t => t.channel === 'agent').length
    const totalPhaseEngines = targets.filter(t => t.channel === 'engine').length

    const successProbStart = phaseSuccessProb(startBudget, targets, currentAgentStateS, currentEngineStateS, currentAgentStateA, currentEngineStateA)
    const successProbEnd = phaseSuccessProb(endBudget, targets, currentAgentStateS, currentEngineStateS, currentAgentStateA, currentEngineStateA)

    currentAgentStateS = agentStateSimS
    currentEngineStateS = engineStateSimS
    currentAgentStateA = agentStateSimA
    currentEngineStateA = engineStateSimA

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
      agentPityEnd: agentStateSimS.pity,
      agentGuaranteedEnd: agentStateSimS.guaranteed,
      enginePityEnd: engineStateSimS.pity,
      engineGuaranteedEnd: engineStateSimS.guaranteed,
      agentPityEndA: agentStateSimA.pity,
      agentGuaranteedEndA: agentStateSimA.guaranteed,
      enginePityEndA: engineStateSimA.pity,
      engineGuaranteedEndA: engineStateSimA.guaranteed,
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
