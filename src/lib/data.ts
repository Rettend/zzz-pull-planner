import { query } from '@solidjs/router'
import { desc } from 'drizzle-orm'
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

  const allBanners = await db.query.banners.findMany({
    orderBy: [desc(banners.startUtc)],
    with: {
      bannerTargets: {
        with: {
          target: true,
        },
        orderBy: [desc(bannerTargets.isFeatured), desc(bannerTargets.order)],
      },
    },
  })

  const data: GameData = {
    banners: [],
    agents: {},
    wEngines: {},
  }

  for (const b of allBanners) {
    // Find the featured target
    const featuredEntry = b.bannerTargets.find((t: any) => t.isFeatured)
    if (!featuredEntry)
      continue

    const featuredTarget = featuredEntry.target

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
    })

    // Populate agents/wEngines maps
    for (const t of b.bannerTargets) {
      const target = t.target
      if (target.type === 'agent') {
        data.agents[target.id] = {
          name: target.displayName,
          rarity: target.rarity,
          attribute: target.attribute ?? undefined,
          specialty: target.specialty ?? undefined,
          icon: target.iconPath ?? undefined,
        }
      }
      else {
        data.wEngines[target.id] = {
          name: target.displayName,
          rarity: target.rarity,
          specialty: target.specialty ?? undefined,
          icon: target.iconPath ?? undefined,
        }
      }
    }
  }

  return data
}, 'game-data')
