import type { Banner, ChannelType } from '~/lib/constants'
import { BANNERS } from '~/lib/constants'

export type Scenario = 'best' | 'expected' | 'worst'

export interface PlannerInputs {
  N: number
  qAgent: number
  qEngine: number
  pullsOnHand: number
  incomePhase1: number
  incomePhase2: number
  pityAgentStart: number
  guaranteedAgentStart: boolean
  pityEngineStart: number
  guaranteedEngineStart: boolean
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
  }
  phase2: {
    agentCost: number
    engineCost: number
    enginePityStart: number
    canAffordAgent: boolean
    canAffordEngineAfterAgent: boolean
    startBudget: number
    endBudget: number
    canAffordAgentStart: boolean
    canAffordEngineAfterAgentStart: boolean
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

function gap(N: number, pity: number): number {
  return Math.max(0, N - pity)
}

export function costToFeaturedAgent(
  N: number,
  pity: number,
  guaranteed: boolean,
  qAgent: number,
  scenario: Scenario,
): number {
  const base = gap(N, pity)
  if (scenario === 'best')
    return base
  if (scenario === 'worst')
    return base + (guaranteed ? 0 : N)
  return base + (guaranteed ? 0 : (1 - qAgent) * N)
}

export function costToFeaturedEngine(
  N: number,
  pity: number,
  guaranteed: boolean,
  qEngine: number,
  scenario: Scenario,
): number {
  const base = gap(N, pity)
  if (scenario === 'best')
    return base
  if (scenario === 'worst')
    return base + (guaranteed ? 0 : N)
  return base + (guaranteed ? 0 : (1 - qEngine) * N)
}

interface SelectedTargetInput { name: string, channel: ChannelType }

function rangeKey(b: Banner): string {
  return `${b.start}→${b.end}`
}

function bannerByFeatured(name: string): Banner | undefined {
  return BANNERS.find(b => b.featured === name)
}

function computePhaseRanges(): string[] {
  const ranges = Array.from(new Set(BANNERS.map(rangeKey)))
  ranges.sort((a, b) => a.localeCompare(b))
  return ranges
}

export function computeTwoPhasePlan(
  inputs: PlannerInputs,
  scenario: Scenario,
  selected: SelectedTargetInput[] = [],
): PhasePlan {
  const {
    N,
    qAgent,
    qEngine,
    pullsOnHand,
    incomePhase1,
    incomePhase2,
    pityAgentStart,
    guaranteedAgentStart,
    pityEngineStart,
    guaranteedEngineStart,
  } = inputs

  const ranges = computePhaseRanges()
  const phaseIndexByTarget: Record<string, 0 | 1> = {}
  for (const t of selected) {
    const b = bannerByFeatured(t.name)
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

  let agentPity = clamp(pityAgentStart, 0, N - 1)
  let agentGuaranteed = Boolean(guaranteedAgentStart)
  let enginePity = clamp(pityEngineStart, 0, N - 1)
  let engineGuaranteed = Boolean(guaranteedEngineStart)

  function reserveForNextPhase(
    nextTargets: SelectedTargetInput[],
    currentAgentState: { pity: number, guaranteed: boolean },
    currentEngineState: { pity: number, guaranteed: boolean },
  ): number {
    let reserve = 0
    const stAgent = { ...currentAgentState }
    const stEngine = { ...currentEngineState }
    for (const t of nextTargets) {
      if (t.channel === 'agent') {
        const c = costToFeaturedAgent(N, stAgent.pity, stAgent.guaranteed, qAgent, scenario)
        reserve += Math.max(0, c)
        stAgent.pity = 0
        stAgent.guaranteed = false
      }
      else {
        const c = costToFeaturedEngine(N, stEngine.pity, stEngine.guaranteed, qEngine, scenario)
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
    nextPhaseAgents: SelectedTargetInput[],
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

    for (const t of targetsInPhase) {
      const isAgent = t.channel === 'agent'
      const cost = isAgent
        ? costToFeaturedAgent(N, agentState.pity, agentState.guaranteed, qAgent, scenario)
        : costToFeaturedEngine(N, engineState.pity, engineState.guaranteed, qEngine, scenario)

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
      const reserveAfter = reserveForNextPhase(nextPhaseAgents, nextAgentState, nextEngineState)
      const affordableEnd = newRemainingEnd >= reserveAfter
      const affordableStart = newRemainingStart >= reserveAfter
      if (!affordableEnd)
        break

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

    const reserveNext = reserveForNextPhase(nextPhaseAgents, agentState, engineState)
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
    }
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
    },
    phase2: {
      agentCost: Math.max(0, phase2AgentsCost),
      engineCost: Math.max(0, phase2EnginesCost),
      enginePityStart: enginePityPhase2Start,
      canAffordAgent: canAffordPhase2Agents,
      canAffordEngineAfterAgent: canAffordPhase2EngineAfterAgent,
      startBudget: Math.max(0, budgetPhase2Start),
      endBudget: Math.max(0, budgetPhase2),
      canAffordAgentStart: canAffordPhase2AgentsStart,
      canAffordEngineAfterAgentStart: canAffordPhase2EngineAfterAgentStart,
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
