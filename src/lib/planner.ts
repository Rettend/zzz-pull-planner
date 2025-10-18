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

export interface CostBreakdown {
  agent: number
  engine: number
}

export interface PhasePlan {
  phase1: {
    agentCost: number
    engineCost: number
    carryToPhase2: number
    // New: richer context for UI/explanations
    budgetStart: number
    reserveForPhase2Agent: number
    allowedEngineSpend: number
    engineSpendThisPhase: number
    canAffordAgent: boolean
    canAffordEngine: boolean
    // Start/End timing details
    startBudget: number
    endBudget: number
    allowedEngineSpendStart: number
    allowedEngineSpendEnd: number
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
    // New: richer context for UI/explanations
    budgetStart: number
    enginePityStart: number
    canAffordAgent: boolean
    canAffordEngineAfterAgent: boolean
    canAffordEngineStandalone: boolean
    // Start/End timing details
    startBudget: number
    endBudget: number
    canAffordAgentStart: boolean
    canAffordEngineAfterAgentStart: boolean
    canAffordEngineStandaloneStart: boolean
  }
  totals: {
    agentsGot: number
    enginesGot: number
    pullsLeftEnd: number
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
  // expected
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

export function computeTwoPhasePlan(
  inputs: PlannerInputs,
  scenario: Scenario,
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

  const budgetPhase1 = pullsOnHand + incomePhase1
  const phase1StartBudget = pullsOnHand
  const phase1EndBudget = budgetPhase1

  // Phase 1 targets: Lucia Agent + Lucia Engine
  const luciaAgentCost = costToFeaturedAgent(
    N,
    pityAgentStart,
    guaranteedAgentStart,
    qAgent,
    scenario,
  )

  const luciaEngineCost = costToFeaturedEngine(
    N,
    pityEngineStart,
    guaranteedEngineStart,
    qEngine,
    scenario,
  )

  // Reserve after phase 1 for a fresh Agent in phase 2 (worst-case of 2N), minus phase 2 income
  const reserveForPhase2Agent = Math.max(0, 2 * N - incomePhase2)

  // Allowed engine spend in phase 1 for start/end-of-phase views
  const allowedEngineSpendP1Start = phase1StartBudget - luciaAgentCost - reserveForPhase2Agent
  const allowedEngineSpendP1End = phase1EndBudget - luciaAgentCost - reserveForPhase2Agent
  // No pity banking and no partial spend: only buy the Engine if you can fully afford it this phase
  const engineSpendP1Start = allowedEngineSpendP1Start >= luciaEngineCost ? luciaEngineCost : 0
  const engineSpendP1End = allowedEngineSpendP1End >= luciaEngineCost ? luciaEngineCost : 0
  const allowedEngineSpendP1 = allowedEngineSpendP1End
  const engineSpendThisPhase = engineSpendP1End

  const carryToPhase2Start = phase1StartBudget - luciaAgentCost - engineSpendP1Start
  const carryToPhase2End = phase1EndBudget - luciaAgentCost - engineSpendP1End
  const carryToPhase2 = carryToPhase2End
  const budgetPhase2Start = carryToPhase2End
  const budgetPhase2 = budgetPhase2Start + incomePhase2

  // Phase 2 targets: Yidhari Agent + Engine. Agent is fresh (no pity, no guarantee)
  const yidhariAgentCost = costToFeaturedAgent(N, 0, false, qAgent, scenario)

  // Engine pity at start of Phase 2
  // - If Lucia Engine was secured in Phase 1: pity resets to 0
  // - If NOT secured: pity remains unchanged (no partial spend carried)
  const enginePityPhase2Start = (engineSpendP1End >= luciaEngineCost) ? 0 : clamp(pityEngineStart, 0, N - 1)
  const yidhariEngineCost = costToFeaturedEngine(N, enginePityPhase2Start, false, qEngine, scenario)

  // Affordability flags
  const canAffordLuciaAgentStart = phase1StartBudget >= luciaAgentCost
  const canAffordLuciaAgentEnd = phase1EndBudget >= luciaAgentCost
  const canAffordLuciaEngineStart = engineSpendP1Start >= luciaEngineCost
  const canAffordLuciaEngineEnd = engineSpendP1End >= luciaEngineCost
  const canAffordLuciaAgent = canAffordLuciaAgentEnd
  const canAffordLuciaEngine = canAffordLuciaEngineEnd

  const canAffordYidhariAgentStart = budgetPhase2Start >= yidhariAgentCost
  const canAffordYidhariAgent = budgetPhase2 >= yidhariAgentCost
  const canAffordYidhariEngineStandaloneStart = budgetPhase2Start >= yidhariEngineCost
  const canAffordYidhariEngineStandalone = budgetPhase2 >= yidhariEngineCost
  const canAffordYidhariEngineAfterAgentStart = (budgetPhase2Start - (canAffordYidhariAgentStart ? yidhariAgentCost : 0)) >= yidhariEngineCost
  const canAffordYidhariEngineAfterAgent = (budgetPhase2 - (canAffordYidhariAgent ? yidhariAgentCost : 0)) >= yidhariEngineCost

  // Count what we can actually afford
  let pullsLeft = budgetPhase2
  let agentsGot = 0
  let enginesGot = 0

  if (budgetPhase1 >= luciaAgentCost) {
    agentsGot += 1
  }
  if (engineSpendThisPhase >= luciaEngineCost) {
    enginesGot += 1
  }

  if (pullsLeft >= yidhariAgentCost) {
    pullsLeft -= yidhariAgentCost
    agentsGot += 1
  }

  if (pullsLeft >= yidhariEngineCost) {
    pullsLeft -= yidhariEngineCost
    enginesGot += 1
  }

  return {
    phase1: {
      agentCost: Math.max(0, luciaAgentCost),
      engineCost: Math.max(0, luciaEngineCost),
      carryToPhase2,
      budgetStart: budgetPhase1,
      reserveForPhase2Agent,
      allowedEngineSpend: Math.max(0, allowedEngineSpendP1),
      engineSpendThisPhase,
      canAffordAgent: canAffordLuciaAgent,
      canAffordEngine: canAffordLuciaEngine,
      startBudget: Math.max(0, phase1StartBudget),
      endBudget: Math.max(0, phase1EndBudget),
      allowedEngineSpendStart: Math.max(0, allowedEngineSpendP1Start),
      allowedEngineSpendEnd: Math.max(0, allowedEngineSpendP1End),
      engineSpendStart: Math.max(0, engineSpendP1Start),
      engineSpendEnd: Math.max(0, engineSpendP1End),
      carryToPhase2Start: Math.max(0, carryToPhase2Start),
      carryToPhase2End: Math.max(0, carryToPhase2End),
      canAffordAgentStart: canAffordLuciaAgentStart,
      canAffordAgentEnd: canAffordLuciaAgentEnd,
      canAffordEngineStart: canAffordLuciaEngineStart,
      canAffordEngineEnd: canAffordLuciaEngineEnd,
    },
    phase2: {
      agentCost: Math.max(0, yidhariAgentCost),
      engineCost: Math.max(0, yidhariEngineCost),
      budgetStart: budgetPhase2,
      enginePityStart: enginePityPhase2Start,
      canAffordAgent: canAffordYidhariAgent,
      canAffordEngineAfterAgent: canAffordYidhariEngineAfterAgent,
      canAffordEngineStandalone: canAffordYidhariEngineStandalone,
      startBudget: Math.max(0, budgetPhase2Start),
      endBudget: Math.max(0, budgetPhase2),
      canAffordAgentStart: canAffordYidhariAgentStart,
      canAffordEngineAfterAgentStart: canAffordYidhariEngineAfterAgentStart,
      canAffordEngineStandaloneStart: canAffordYidhariEngineStandaloneStart,
    },
    totals: {
      agentsGot,
      enginesGot,
      pullsLeftEnd: Math.max(0, pullsLeft),
    },
  }
}
