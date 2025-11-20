import type { Banner, ChannelType } from '~/lib/constants'
import { convolveDiscrete, costAtScenario, costStatsFromPmf, featuredCostPmf } from '~/lib/probability'

export type Scenario = 'p50' | 'p60' | 'p75' | 'p90' | 'ev'

export interface PlannerInputs {
  N: number
  pullsOnHand: number
  incomePhase1: number
  incomePhase2: number
  pityAgentStart: number
  guaranteedAgentStart: boolean
  pityEngineStart: number
  guaranteedEngineStart: boolean
  luckMode?: 'best' | 'realistic' | 'worst'
}

export interface PhasePlan {
  phase1: {
    agentCost: number
    engineCost: number
    reserveForPhase2: number
    startBudget: number
    endBudget: number
    engineSpendStart: number
    engineSpendEnd: number
    carryToPhase2Start: number
    carryToPhase2End: number
    canAffordAgentStart: boolean
    canAffordAgentEnd: boolean
    canAffordEngineStart: boolean
    canAffordEngineEnd: boolean
    successProbStart?: number
    successProbEnd?: number
    shortfallStart?: number
    shortfallEnd?: number
  }
  phase2: {
    agentCost: number
    engineCost: number
    enginePityStart: number
    agentPityStart?: number
    agentGuaranteedStart?: boolean
    engineGuaranteedStart?: boolean
    canAffordAgent: boolean
    canAffordEngineAfterAgent: boolean
    startBudget: number
    endBudget: number
    canAffordAgentStart: boolean
    canAffordEngineAfterAgentStart: boolean
    successProbStart?: number
    successProbEnd?: number
    shortfallStart?: number
    shortfallEnd?: number
  }
  totals: {
    agentsGot: number
    enginesGot: number
    pullsLeftEnd: number
  }
  fundedTargets: string[]
  fundedTargetsPhase1: string[]
  fundedTargetsPhase2: string[]
}

export function emptyPlan(): PhasePlan {
  return {
    phase1: {
      agentCost: 0,
      engineCost: 0,
      reserveForPhase2: 0,
      startBudget: 0,
      endBudget: 0,
      engineSpendStart: 0,
      engineSpendEnd: 0,
      carryToPhase2Start: 0,
      carryToPhase2End: 0,
      canAffordAgentStart: false,
      canAffordAgentEnd: false,
      canAffordEngineStart: false,
      canAffordEngineEnd: false,
      shortfallStart: 0,
      shortfallEnd: 0,
    },
    phase2: {
      agentCost: 0,
      engineCost: 0,
      enginePityStart: 0,
      canAffordAgent: false,
      canAffordEngineAfterAgent: false,
      startBudget: 0,
      endBudget: 0,
      canAffordAgentStart: false,
      canAffordEngineAfterAgentStart: false,
      shortfallStart: 0,
      shortfallEnd: 0,
    },
    totals: { agentsGot: 0, enginesGot: 0, pullsLeftEnd: 0 },
    fundedTargets: [],
    fundedTargetsPhase1: [],
    fundedTargetsPhase2: [],
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

interface SelectedTargetInput { name: string, channel: ChannelType }

function rangeKey(b: Banner): string {
  return `${b.start}→${b.end}`
}

function bannerByFeatured(banners: Banner[], name: string): Banner | undefined {
  return banners.find(b => b.featured === name)
}

function computePhaseRanges(banners: Banner[]): string[] {
  const ranges = Array.from(new Set(banners.map(rangeKey)))
  ranges.sort((a, b) => a.localeCompare(b))
  return ranges
}

export function computeTwoPhasePlan(
  banners: Banner[],
  inputs: PlannerInputs,
  scenario: Scenario,
  selected: SelectedTargetInput[] = [],
): PhasePlan {
  const {
    pullsOnHand,
    incomePhase1,
    incomePhase2,
    pityAgentStart,
    guaranteedAgentStart,
    pityEngineStart,
    guaranteedEngineStart,
    luckMode = 'realistic',
  } = inputs

  const qAgent = luckMode === 'best' ? 1 : luckMode === 'worst' ? 0 : 0.5
  const qEngine = luckMode === 'best' ? 1 : luckMode === 'worst' ? 0 : 0.75

  const ranges = computePhaseRanges(banners)
  const phaseIndexByTarget: Record<string, 0 | 1> = {}
  for (const t of selected) {
    const b = bannerByFeatured(banners, t.name)
    if (b) {
      const idx = ranges.indexOf(rangeKey(b))
      phaseIndexByTarget[t.name] = (idx <= 0 ? 0 : 1)
    }
    else {
      phaseIndexByTarget[t.name] = 0
    }
  }

  const phase1Targets = selected.filter(t => phaseIndexByTarget[t.name] === 0)
  const phase2Targets = selected.filter(t => phaseIndexByTarget[t.name] === 1)

  const phase1StartBudget = pullsOnHand
  const phase1EndBudget = pullsOnHand + incomePhase1

  let agentPity = clamp(pityAgentStart, 0, 89)
  let agentGuaranteed = Boolean(guaranteedAgentStart)
  let enginePity = clamp(pityEngineStart, 0, 79)
  let engineGuaranteed = Boolean(guaranteedEngineStart)

  const globalIndexByName: Record<string, number> = {}
  for (let i = 0; i < selected.length; i++) {
    const t = selected[i]
    if (globalIndexByName[t.name] === undefined)
      globalIndexByName[t.name] = i
  }

  function reserveForNextPhase(
    nextTargets: SelectedTargetInput[],
    currentAgentState: { pity: number, guaranteed: boolean },
    currentEngineState: { pity: number, guaranteed: boolean },
    limitIndexExclusive: number = Number.POSITIVE_INFINITY,
  ): number {
    let reserve = 0
    const stAgent = { ...currentAgentState }
    const stEngine = { ...currentEngineState }
    for (const t of nextTargets) {
      const gIdx = globalIndexByName[t.name]
      if (gIdx === undefined || gIdx >= limitIndexExclusive)
        continue
      if (t.channel === 'agent') {
        const c = costToFeaturedAgent(stAgent.pity, stAgent.guaranteed, qAgent, scenario)
        reserve += Math.max(0, c)
        stAgent.pity = 0
        stAgent.guaranteed = false
      }
      else {
        const c = costToFeaturedEngine(stEngine.pity, stEngine.guaranteed, qEngine, scenario)
        reserve += Math.max(0, c)
        stEngine.pity = 0
        stEngine.guaranteed = false
      }
    }
    return reserve
  }

  function simulatePhaseOrdered(
    startBudget: number,
    endBudget: number,
    targetsInPhase: SelectedTargetInput[],
    agentStateIn: { pity: number, guaranteed: boolean },
    engineStateIn: { pity: number, guaranteed: boolean },
    nextPhaseTargets: SelectedTargetInput[],
  ) {
    let remainingStart = startBudget
    let remainingEnd = endBudget
    const agentState = { ...agentStateIn }
    const engineState = { ...engineStateIn }
    let spentAgents = 0
    let spentEngines = 0
    let boughtAgents = 0
    let boughtEngines = 0
    const boughtNames: string[] = []
    let shortfallStart: number | undefined
    let shortfallEnd: number | undefined

    for (const t of targetsInPhase) {
      const isAgent = t.channel === 'agent'
      const cost = isAgent
        ? costToFeaturedAgent(agentState.pity, agentState.guaranteed, qAgent, scenario)
        : costToFeaturedEngine(engineState.pity, engineState.guaranteed, qEngine, scenario)

      const nextAgentState = { ...agentState }
      const nextEngineState = { ...engineState }
      if (isAgent) {
        nextAgentState.pity = 0
        nextAgentState.guaranteed = false
      }
      else {
        nextEngineState.pity = 0
        nextEngineState.guaranteed = false
      }

      const newRemainingEnd = remainingEnd - cost
      const newRemainingStart = remainingStart - cost
      const currentGlobalIndex = globalIndexByName[t.name] ?? Number.POSITIVE_INFINITY
      const reserveAfter = reserveForNextPhase(nextPhaseTargets, nextAgentState, nextEngineState, currentGlobalIndex)
      const affordableEnd = newRemainingEnd >= reserveAfter
      const affordableStart = newRemainingStart >= reserveAfter
      if (!affordableEnd) {
        shortfallEnd = Math.max(0, reserveAfter - newRemainingEnd)
        shortfallStart = Math.max(0, reserveAfter - newRemainingStart)
        break
      }

      remainingEnd = newRemainingEnd
      if (affordableStart)
        remainingStart = newRemainingStart

      if (isAgent) {
        spentAgents += cost
        boughtAgents += 1
        boughtNames.push(t.name)
        agentState.pity = nextAgentState.pity
        agentState.guaranteed = nextAgentState.guaranteed
      }
      else {
        spentEngines += cost
        boughtEngines += 1
        boughtNames.push(t.name)
        engineState.pity = nextEngineState.pity
        engineState.guaranteed = nextEngineState.guaranteed
      }
    }

    const reserveNext = reserveForNextPhase(nextPhaseTargets, agentState, engineState, Number.POSITIVE_INFINITY)
    return {
      remainingStart,
      remainingEnd,
      spentAgents,
      spentEngines,
      boughtAgents,
      boughtEngines,
      agentStateAfter: agentState,
      engineStateAfter: engineState,
      reserveForNextPhase: reserveNext,
      boughtNames,
      shortfallStart,
      shortfallEnd,
    }
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
      const pmf = t.channel === 'agent'
        ? featuredCostPmf('agent', agentState.pity, agentState.guaranteed, qAgent)
        : featuredCostPmf('engine', engineState.pity, engineState.guaranteed, qEngine)
      pmfTotal = convolveDiscrete(pmfTotal, pmf)
      if (t.channel === 'agent') {
        agentState.pity = 0
        agentState.guaranteed = false
      }
      else {
        engineState.pity = 0
        engineState.guaranteed = false
      }
    }
    const b = Math.max(0, Math.floor(budget))
    let acc = 0
    for (let i = 0; i < pmfTotal.length && i + 1 <= b; i++) acc += pmfTotal[i]
    return Math.max(0, Math.min(1, acc))
  }

  const simP1 = simulatePhaseOrdered(
    phase1StartBudget,
    phase1EndBudget,
    phase1Targets,
    { pity: agentPity, guaranteed: agentGuaranteed },
    { pity: enginePity, guaranteed: engineGuaranteed },
    phase2Targets,
  )

  agentPity = simP1.agentStateAfter.pity
  agentGuaranteed = simP1.agentStateAfter.guaranteed
  enginePity = simP1.engineStateAfter.pity
  engineGuaranteed = simP1.engineStateAfter.guaranteed

  const engineSpendP1End = Math.max(0, simP1.spentEngines)
  const engineSpendP1Start = Math.max(0, Math.min(simP1.spentEngines, Math.max(0, simP1.remainingStart - simP1.reserveForNextPhase)))
  const totalPhase1Agents = phase1Targets.filter(t => t.channel === 'agent').length
  const totalPhase1Engines = phase1Targets.filter(t => t.channel === 'engine').length

  const carryToPhase2Start = Math.max(0, simP1.remainingStart)
  const carryToPhase2End = Math.max(0, simP1.remainingEnd)
  const budgetPhase2Start = carryToPhase2End
  const budgetPhase2 = budgetPhase2Start + incomePhase2

  function simulatePhase2(total: number) {
    return simulatePhaseOrdered(
      total,
      total,
      phase2Targets,
      { pity: agentPity, guaranteed: agentGuaranteed },
      { pity: enginePity, guaranteed: engineGuaranteed },
      [],
    )
  }
  const phase2StartSim = simulatePhase2(budgetPhase2Start)
  const phase2EndSim = simulatePhase2(budgetPhase2)
  const enginePityPhase2Start = enginePity
  const agentPityPhase2Start = agentPity
  const agentGuaranteedPhase2Start = agentGuaranteed
  const engineGuaranteedPhase2Start = engineGuaranteed
  const phase2AgentsCost = Math.max(0, phase2EndSim.spentAgents)
  const phase2EnginesCost = Math.max(0, phase2EndSim.spentEngines)
  const totalPhase2Agents = phase2Targets.filter(t => t.channel === 'agent').length
  const totalPhase2Engines = phase2Targets.filter(t => t.channel === 'engine').length

  const canAffordPhase2AgentsStart = phase2StartSim.boughtAgents === totalPhase2Agents
  const canAffordPhase2Agents = phase2EndSim.boughtAgents === totalPhase2Agents
  const canAffordPhase2EngineAfterAgentStart = phase2StartSim.boughtEngines === totalPhase2Engines
  const canAffordPhase2EngineAfterAgent = phase2EndSim.boughtEngines === totalPhase2Engines

  const agentsGot = simP1.boughtAgents + phase2EndSim.boughtAgents
  const enginesGot = simP1.boughtEngines + phase2EndSim.boughtEngines
  const pullsLeft = budgetPhase2 - phase2EndSim.spentAgents - phase2EndSim.spentEngines

  const phase1SuccessStart = phaseSuccessProb(
    phase1StartBudget,
    phase1Targets,
    { pity: clamp(pityAgentStart, 0, 89), guaranteed: Boolean(guaranteedAgentStart) },
    { pity: clamp(pityEngineStart, 0, 79), guaranteed: Boolean(guaranteedEngineStart) },
  )
  const phase1SuccessEnd = phaseSuccessProb(
    phase1EndBudget,
    phase1Targets,
    { pity: clamp(pityAgentStart, 0, 89), guaranteed: Boolean(guaranteedAgentStart) },
    { pity: clamp(pityEngineStart, 0, 79), guaranteed: Boolean(guaranteedEngineStart) },
  )
  const phase2SuccessStart = phaseSuccessProb(
    budgetPhase2Start,
    phase2Targets,
    { pity: agentPity, guaranteed: agentGuaranteed },
    { pity: enginePity, guaranteed: engineGuaranteed },
  )
  const phase2SuccessEnd = phaseSuccessProb(
    budgetPhase2,
    phase2Targets,
    { pity: agentPity, guaranteed: agentGuaranteed },
    { pity: enginePity, guaranteed: engineGuaranteed },
  )

  return {
    phase1: {
      agentCost: Math.max(0, simP1.spentAgents),
      engineCost: Math.max(0, simP1.spentEngines),
      reserveForPhase2: Math.max(0, simP1.reserveForNextPhase),
      startBudget: Math.max(0, phase1StartBudget),
      endBudget: Math.max(0, phase1EndBudget),
      engineSpendStart: Math.max(0, engineSpendP1Start),
      engineSpendEnd: Math.max(0, engineSpendP1End),
      carryToPhase2Start: Math.max(0, carryToPhase2Start),
      carryToPhase2End: Math.max(0, carryToPhase2End),
      canAffordAgentStart: (simP1.boughtAgents === totalPhase1Agents) && (simP1.spentAgents <= phase1StartBudget),
      canAffordAgentEnd: (simP1.boughtAgents === totalPhase1Agents),
      canAffordEngineStart: (simP1.boughtEngines === totalPhase1Engines) && (engineSpendP1Start === engineSpendP1End),
      canAffordEngineEnd: (simP1.boughtEngines === totalPhase1Engines),
      successProbStart: phase1SuccessStart,
      successProbEnd: phase1SuccessEnd,
      shortfallStart: Math.max(0, simP1.shortfallStart ?? 0),
      shortfallEnd: Math.max(0, simP1.shortfallEnd ?? 0),
    },
    phase2: {
      agentCost: Math.max(0, phase2AgentsCost),
      engineCost: Math.max(0, phase2EnginesCost),
      enginePityStart: enginePityPhase2Start,
      agentPityStart: agentPityPhase2Start,
      agentGuaranteedStart: agentGuaranteedPhase2Start,
      engineGuaranteedStart: engineGuaranteedPhase2Start,
      canAffordAgent: canAffordPhase2Agents,
      canAffordEngineAfterAgent: canAffordPhase2EngineAfterAgent,
      startBudget: Math.max(0, budgetPhase2Start),
      endBudget: Math.max(0, budgetPhase2),
      canAffordAgentStart: canAffordPhase2AgentsStart,
      canAffordEngineAfterAgentStart: canAffordPhase2EngineAfterAgentStart,
      successProbStart: phase2SuccessStart,
      successProbEnd: phase2SuccessEnd,
      shortfallStart: Math.max(0, phase2StartSim.shortfallEnd ?? 0),
      shortfallEnd: Math.max(0, phase2EndSim.shortfallEnd ?? 0),
    },
    totals: {
      agentsGot,
      enginesGot,
      pullsLeftEnd: Math.max(0, pullsLeft),
    },
    fundedTargets: [...simP1.boughtNames, ...phase2EndSim.boughtNames],
    fundedTargetsPhase1: [...simP1.boughtNames],
    fundedTargetsPhase2: [...phase2EndSim.boughtNames],
  }
}
