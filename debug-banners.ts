import { Database } from 'bun:sqlite'
import { asc, desc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './src/db/schema'

async function main() {
  const db = new Database('drizzle/local.db')
  const client = drizzle(db, { schema })
  const allBanners = await client.query.banners.findMany({
    orderBy: [asc(schema.banners.startUtc)],
    with: {
      bannerTargets: {
        with: {
          target: true,
        },
        orderBy: [desc(schema.bannerTargets.isFeatured), asc(schema.bannerTargets.order)],
      },
    },
  })

  // Track first appearance of each character
  const firstAppearance = new Map<string, number>()
  for (const b of allBanners) {
    const featured = b.bannerTargets.find(t => t.isFeatured && t.target.rarity === 5)?.target
    if (featured) {
      if (!firstAppearance.has(featured.id)) {
        firstAppearance.set(featured.id, b.startUtc)
      }
    }
  }

  // Build banner data structure similar to frontend
  const formattedBanners = allBanners
    .filter((b) => {
      const featured = b.bannerTargets.find(t => t.isFeatured && t.target.rarity === 5)
      return !!featured
    })
    .map((b) => {
      const featured = b.bannerTargets.find(t => t.isFeatured && t.target.rarity === 5)!.target
      return {
        id: b.id,
        title: b.title,
        type: b.channelType,
        startUtc: b.startUtc,
        start: new Date(b.startUtc * 1000).toISOString().split('T')[0],
        featured: featured.id,
        featuredName: featured.displayName,
      }
    })

  // Sort using the same logic as the frontend
  formattedBanners.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start.localeCompare(b.start)
    }

    const aFirstAppearance = firstAppearance.get(a.featured)
    const bFirstAppearance = firstAppearance.get(b.featured)
    const aStartUtc = Math.floor(new Date(a.start).getTime() / 1000)
    const bStartUtc = Math.floor(new Date(b.start).getTime() / 1000)
    const aIsRerun = aFirstAppearance !== undefined && aFirstAppearance < aStartUtc
    const bIsRerun = bFirstAppearance !== undefined && bFirstAppearance < bStartUtc

    const getOrder = (banner: typeof a, isRerun: boolean) => {
      if (!isRerun && banner.type === 'agent')
        return 0
      if (!isRerun && banner.type === 'engine')
        return 1
      if (isRerun && banner.type === 'agent')
        return 2
      if (isRerun && banner.type === 'engine')
        return 3
      return 4
    }

    return getOrder(a, aIsRerun) - getOrder(b, bIsRerun)
  })

  // Group and display last 3 time periods
  const grouped = new Map<string, typeof formattedBanners>()
  for (const b of formattedBanners) {
    if (!grouped.has(b.start)) {
      grouped.set(b.start, [])
    }
    grouped.get(b.start)!.push(b)
  }

  const sortedDates = Array.from(grouped.keys()).sort().slice(-3)

  for (const date of sortedDates) {
    const banners = grouped.get(date)!
    // eslint-disable-next-line no-console
    console.log(`\n=== ${date} ===`)

    for (const b of banners) {
      const isRerun = firstAppearance.get(b.featured)! < b.startUtc
      // eslint-disable-next-line no-console
      console.log(`[${b.type}] ${b.featuredName} ${isRerun ? '(RERUN)' : '(NEW)'}`)
    }
  }
}

main()
