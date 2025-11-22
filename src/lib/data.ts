import { query } from '@solidjs/router'
import { asc, desc } from 'drizzle-orm'
import { useDb } from '~/db/client'
import { banners, bannerTargets } from '~/db/schema'

export interface GameData {
  banners: Array<{
    id: string
    title: string
    type: 'agent' | 'engine'
    start: string
    end: string
    featured: string
    featuredRarity: number
    featuredIcon?: string
    featuredAttribute?: string
    featuredSpecialty?: string
    featuredTargets: string[]
  }>
  agents: Record<string, {
    name: string
    rarity: number
    attribute?: string
    specialty?: string
    icon?: string
  }>
  wEngines: Record<string, {
    name: string
    rarity: number
    specialty?: string
    icon?: string
  }>
}

export const getGameData = query(async (): Promise<GameData> => {
  'use server'
  const db = await useDb()

  if (!db) {
    return {
      banners: [],
      agents: {},
      wEngines: {},
    }
  }

  const allBanners = await db.query.banners.findMany({
    orderBy: [asc(banners.startUtc)],
    with: {
      bannerTargets: {
        with: {
          target: true,
        },
        orderBy: [desc(bannerTargets.isFeatured), asc(bannerTargets.order)],
      },
    },
  })

  // Track first appearance of each featured character to detect reruns
  const firstAppearance = new Map<string, number>()
  for (const b of allBanners) {
    const featuredEntry = b.bannerTargets.find((t: any) => t.isFeatured && t.target.rarity === 5)
    if (featuredEntry) {
      const targetId = featuredEntry.target.id
      if (!firstAppearance.has(targetId)) {
        firstAppearance.set(targetId, b.startUtc)
      }
    }
  }

  const data: GameData = {
    banners: [],
    agents: {},
    wEngines: {},
  }

  for (const b of allBanners) {
    // Find the featured target (prioritize S-rank)
    const featuredEntry = b.bannerTargets.find((t: any) => t.isFeatured && t.target.rarity === 5)
    if (!featuredEntry)
      continue

    const featuredTarget = featuredEntry.target

    // Get all featured targets (S and A rank)
    const featuredTargets = b.bannerTargets
      .filter((t: any) => t.isFeatured)
      .map((t: any) => t.target.id)

    // Format dates YYYY-MM-DD
    const startDate = new Date(b.startUtc * 1000).toISOString().split('T')[0]
    const endDate = new Date(b.endUtc * 1000).toISOString().split('T')[0]

    data.banners.push({
      id: b.id,
      title: b.title,
      type: b.channelType as 'agent' | 'engine',
      start: startDate,
      end: endDate,
      featured: featuredTarget.id,
      featuredRarity: featuredTarget.rarity,
      featuredIcon: featuredTarget.iconPath ?? undefined,
      featuredAttribute: featuredTarget.attribute ?? undefined,
      featuredSpecialty: featuredTarget.specialty ?? undefined,
      featuredTargets,
    })

    // Populate agents/wEngines maps
    for (const t of b.bannerTargets) {
      const target = t.target
      if (target.type === 'agent') {
        // Always add agent if not exists, or update if needed
        if (!data.agents[target.id]) {
          data.agents[target.id] = {
            name: target.displayName,
            rarity: target.rarity,
            attribute: target.attribute ?? undefined,
            specialty: target.specialty ?? undefined,
            icon: target.iconPath ?? undefined,
          }
        }
      }
      else {
        if (!data.wEngines[target.id]) {
          data.wEngines[target.id] = {
            name: target.displayName,
            rarity: target.rarity,
            specialty: target.specialty ?? undefined,
            icon: target.iconPath ?? undefined,
          }
        }
      }
    }
  }

  // Sort banners: for concurrent banners (same start time), order by:
  // 1. New agent banners
  // 2. New engine banners
  // 3. Rerun agent banners
  // 4. Rerun engine banners
  data.banners.sort((a, b) => {
    // First sort by start date
    if (a.start !== b.start) {
      return a.start.localeCompare(b.start)
    }

    // For concurrent banners, determine if each is a rerun
    const aFirstAppearance = firstAppearance.get(a.featured)
    const bFirstAppearance = firstAppearance.get(b.featured)

    // Parse start dates to compare with first appearances
    const aStartUtc = Math.floor(new Date(a.start).getTime() / 1000)
    const bStartUtc = Math.floor(new Date(b.start).getTime() / 1000)

    const aIsRerun = aFirstAppearance !== undefined && aFirstAppearance < aStartUtc
    const bIsRerun = bFirstAppearance !== undefined && bFirstAppearance < bStartUtc

    // Sort by: new agents, rerun agents, new engines, rerun engines
    const getOrder = (banner: typeof a, isRerun: boolean) => {
      if (!isRerun && banner.type === 'agent')
        return 0
      if (isRerun && banner.type === 'agent')
        return 1
      if (!isRerun && banner.type === 'engine')
        return 2
      if (isRerun && banner.type === 'engine')
        return 3
      return 4
    }

    return getOrder(a, aIsRerun) - getOrder(b, bIsRerun)
  })

  return data
}, 'game-data')
