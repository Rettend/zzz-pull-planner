import type { ChannelType } from './constants'

export interface CostStats {
  ev: number
  p50: number
  p60: number
  p75: number
  p90: number
  probWithin: (budget: number) => number
}

function generateHazard(cap: number, softStart: number, baseRate: number, rampRate: number): number[] {
  const hazards: number[] = Array.from({ length: cap }, () => 0)
  // Early region: flat base rate
  for (let k = 1; k <= cap; k++) {
    if (k < softStart) {
      hazards[k - 1] = baseRate
    }
    else if (k < cap) {
      // Linear ramp: increases by rampRate each pull starting from softStart
      const steps = k - softStart + 1
      const ramp = baseRate + steps * rampRate
      hazards[k - 1] = Math.min(1, ramp)
    }
    else {
      hazards[k - 1] = 1
    }
  }

  let survival = 1
  for (let k = 1; k < cap; k++) {
    const hk = Math.max(0, Math.min(1, hazards[k - 1]))
    survival *= (1 - hk)
  }
  hazards[cap - 1] = Math.max(0, Math.min(1, 1 - survival))
  return hazards
}

export function getDefaultHazard(channel: ChannelType): { hazards: number[], cap: number } {
  if (channel === 'agent') {
    const cap = 90
    const softStart = 74
    const baseRate = 0.006 // 0.6%
    const rampRate = 0.060 // +6% per pull
    return { hazards: generateHazard(cap, softStart, baseRate, rampRate), cap }
  }
  else {
    const cap = 80
    const softStart = 64
    const baseRate = 0.010 // 1.0%
    const rampRate = 0.060 // +6% per pull (assumed similar to agent)
    return { hazards: generateHazard(cap, softStart, baseRate, rampRate), cap }
  }
}

export function getARankHazard(baseRate: number): { hazards: number[], cap: number } {
  const cap = 10
  const hazards = Array.from({ length: cap }, (_, i) => {
    const k = i + 1
    if (k === 10)
      return 1.0
    if (k === 9)
      return Math.min(1.0, baseRate + 0.4)
    return baseRate
  })
  return { hazards, cap }
}

// Slice hazard by current pity p0 (0..cap-1). Returns remaining hazards for j=1..(cap-p0), enforcing CMF(remCap)=1.
export function hazardWithPityOffset(allHazards: number[], p0: number): number[] {
  const cap = allHazards.length
  const p = Math.max(0, Math.min(cap - 1, p0))
  return allHazards.slice(p, cap)
}

export function firstSPmfFromHazard(h: number[]): number[] {
  const n = h.length
  const pmf: number[] = Array.from({ length: n }, () => 0)
  let survival = 1
  for (let k = 1; k <= n; k++) {
    const hk = Math.max(0, Math.min(1, h[k - 1]))
    const pk = survival * hk
    pmf[k - 1] = pk
    survival *= (1 - hk)
  }
  const sum = pmf.reduce((a, b) => a + b, 0)
  if (sum > 0 && Math.abs(1 - sum) > 1e-9) {
    for (let i = 0; i < pmf.length; i++) pmf[i] /= sum
  }
  return pmf
}

export function pmfToCmf(pmf: number[]): number[] {
  const cmf: number[] = Array.from({ length: pmf.length }, () => 0)
  let acc = 0
  for (let i = 0; i < pmf.length; i++) {
    acc += pmf[i]
    cmf[i] = Math.max(0, Math.min(1, acc))
  }
  return cmf
}

export function expectedValue(pmf: number[]): number {
  let ev = 0
  for (let i = 0; i < pmf.length; i++) ev += (i + 1) * pmf[i]
  return ev
}

export function quantileFromCmf(cmf: number[], p: number): number {
  const q = Math.max(0, Math.min(1, p))
  for (let i = 0; i < cmf.length; i++) {
    if (cmf[i] >= q)
      return i + 1
  }
  return cmf.length
}

export function convolveDiscrete(a: number[], b: number[]): number[] {
  const n = a.length
  const m = b.length
  const out: number[] = Array.from({ length: n + m - 1 }, () => 0)
  for (let i = 0; i < n; i++) {
    const ai = a[i]
    if (ai === 0)
      continue
    for (let j = 0; j < m; j++) {
      const bj = b[j]
      if (bj === 0)
        continue
      out[i + j] += ai * bj
    }
  }
  const sum = out.reduce((acc: number, v: number) => acc + v, 0)
  if (sum > 0 && Math.abs(1 - sum) > 1e-9) {
    for (let i = 0; i < out.length; i++) out[i] /= sum
  }
  return out
}

export function featuredCostPmf(
  channel: ChannelType,
  pity: number,
  guaranteed: boolean,
  qFeatured: number,
  customHazards?: number[],
): number[] {
  const { hazards } = getDefaultHazard(channel)
  const base = customHazards ?? hazards
  const h = hazardWithPityOffset(base, pity)
  const pmfT1 = firstSPmfFromHazard(h)
  if (guaranteed)
    return pmfT1
  const pmfT2 = firstSPmfFromHazard(base) // fresh after reset
  const pmfSum = convolveDiscrete(pmfT1, pmfT2)
  const q = Math.max(0, Math.min(1, qFeatured))
  // Mixture: q * T1 + (1-q) * (T1+T2)
  const len = Math.max(pmfT1.length, pmfSum.length)
  const out: number[] = Array.from({ length: len }, () => 0)
  for (let i = 0; i < len; i++) {
    const a = i < pmfT1.length ? pmfT1[i] : 0
    const b = i < pmfSum.length ? pmfSum[i] : 0
    out[i] = q * a + (1 - q) * b
  }
  const s = out.reduce((acc, v) => acc + v, 0)
  if (s > 0 && Math.abs(1 - s) > 1e-9) {
    for (let i = 0; i < out.length; i++) out[i] /= s
  }
  return out
}

export function geometricCostPmf(
  hazards: number[],
  pSuccess: number,
  limitMass: number = 0.999,
  pity: number = 0,
): number[] {
  // Cost of a single drop (fresh)
  const pmfOne = firstSPmfFromHazard(hazards)
  // Cost of the first drop (with pity)
  const pmfOnePity = pity > 0 ? firstSPmfFromHazard(hazardWithPityOffset(hazards, pity)) : pmfOne

  // We want to compute PMF of Total Cost = Sum(Cost_i) for i=1..N
  // Where N ~ Geometric(pSuccess)
  // P(N=k) = (1-p)^(k-1) * p

  // Result = Sum_{k=1..inf} P(N=k) * PMF_k
  // where PMF_k is convolution of k copies of pmfOne (but first one is pmfOnePity)

  let out: number[] = []
  let currentConvolved = [...pmfOnePity] // PMF for k=1
  const currentProbN = pSuccess // P(N=1)
  let accumulatedProb = 0

  // k=1
  out = Array.from({ length: currentConvolved.length }, () => 0)
  for (let i = 0; i < currentConvolved.length; i++) {
    out[i] += currentConvolved[i] * currentProbN
  }
  accumulatedProb += currentProbN

  // k=2..max
  // We stop when accumulated probability of N is high enough
  let k = 2
  while (accumulatedProb < limitMass && k < 50) { // Safety break at 50 trials
    const pN = (1 - pSuccess) ** (k - 1) * pSuccess
    currentConvolved = convolveDiscrete(currentConvolved, pmfOne)

    // Add to out
    if (currentConvolved.length > out.length) {
      const newOut = Array.from({ length: currentConvolved.length }, () => 0)
      for (let i = 0; i < out.length; i++) newOut[i] = out[i]
      out = newOut
    }

    for (let i = 0; i < currentConvolved.length; i++) {
      out[i] += currentConvolved[i] * pN
    }

    accumulatedProb += pN
    k++
  }

  // Normalize
  const s = out.reduce((acc, v) => acc + v, 0)
  if (s > 0) {
    for (let i = 0; i < out.length; i++) out[i] /= s
  }
  return out
}

export function costStatsFromPmf(pmf: number[]): CostStats {
  const cmf = pmfToCmf(pmf)
  const ev = expectedValue(pmf)
  const p50 = quantileFromCmf(cmf, 0.50)
  const p60 = quantileFromCmf(cmf, 0.60)
  const p75 = quantileFromCmf(cmf, 0.75)
  const p90 = quantileFromCmf(cmf, 0.90)
  const probWithin = (budget: number) => {
    const b = Math.max(0, Math.floor(budget))
    if (b <= 0)
      return 0
    const idx = Math.min(cmf.length - 1, b - 1)
    return cmf[idx]
  }
  return { ev, p50, p60, p75, p90, probWithin }
}

export function costAtScenario(
  scenario: 'p50' | 'p60' | 'p75' | 'p90' | 'ev',
  stats: CostStats,
): number {
  switch (scenario) {
    case 'p50':
      return stats.p50
    case 'p60':
      return stats.p60
    case 'p75':
      return stats.p75
    case 'p90':
      return stats.p90
    case 'ev':
    default:
      return stats.ev
  }
}
