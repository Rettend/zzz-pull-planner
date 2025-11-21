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

// Slice hazard by current pity p0 (0..cap-1). Returns remaining hazards for j=1..(cap-p0), enforcing CMF(remCap)=1.
export function hazardWithPityOffset(allHazards: number[], p0: number): number[] {
  const cap = allHazards.length
  const p = Math.max(0, Math.min(cap - 1, p0))
  const remain = cap - p
  const sliced = allHazards.slice(p, cap)
  let survival = 1
  for (let i = 0; i < remain - 1; i++) survival *= (1 - Math.max(0, Math.min(1, sliced[i])))
  sliced[remain - 1] = Math.max(0, Math.min(1, 1 - survival))
  return sliced
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
  const { hazards, cap } = getDefaultHazard(channel)
  const base = customHazards && customHazards.length === cap ? customHazards : hazards
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
