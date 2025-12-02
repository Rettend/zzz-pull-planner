/* eslint-disable no-console */
import type { Banner, Target } from '../../db/schema'
import type { VersionDataMap } from './types'

import { eq, sql } from 'drizzle-orm'
import { banners, bannerTargets, scrapeRuns, targets } from '../../db/schema'
import { normalizeName } from '../../lib/utils'
import { downloadImage, fetchWikiPage } from './fetch'
import { parseHistoryPage } from './parsers/history'
import { parseVersionPage } from './parsers/version'
import { checkR2FileExists, uploadToR2 } from './r2'

const AGENT_HISTORY_URL = 'https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Exclusive_Channel/History&prop=text&format=json'
const ENGINE_HISTORY_URL = 'https://zenless-zone-zero.fandom.com/api.php?action=parse&page=W-Engine_Channel/History&prop=text&format=json'

export async function scrapeBanners(db: any, r2?: R2Bucket, force = false) {
  const runId = await logRunStart(db)
  console.log(`Starting scrape run ${runId}...`)

  try {
    // 0. Load existing data to memory to minimize DB reads
    console.log('Loading existing data from DB...')
    const existingBanners = await db.select().from(banners).all() as Banner[]
    const existingTargets = await db.select().from(targets).all() as Target[]

    const existingBannersMap = new Map(existingBanners.map(b => [b.id, b]))
    const existingTargetsMap = new Map(existingTargets.map(t => [t.id, t]))

    console.log(`Loaded ${existingBanners.length} banners and ${existingTargets.length} targets.`)

    // 1. Fetch and Parse History Pages
    console.log('Fetching history pages...')
    const [agentData, engineData] = await Promise.all([
      fetchWikiPage(AGENT_HISTORY_URL),
      fetchWikiPage(ENGINE_HISTORY_URL),
    ])

    const agentBanners = parseHistoryPage(agentData, 'agent')
    const engineBanners = parseHistoryPage(engineData, 'engine')
    const allBanners = [...agentBanners, ...engineBanners]
    console.log(`Parsed ${allBanners.length} banners from history.`)

    // 2. Determine which versions need fetching
    const allVersions = Array.from(new Set(allBanners.map(b => b.version))).filter(v => /^\d+\.\d+$/.test(v))
    const versionsToFetch = new Set<string>()

    if (force) {
      allVersions.forEach(v => versionsToFetch.add(v))
    }
    else {
      // Check if we have missing attribute/specialty for any target in a version
      const now = Date.now() / 1000
      for (const banner of allBanners) {
        // Skip past banners
        if (banner.endUtc < now)
          continue

        if (!versionsToFetch.has(banner.version)) {
          for (const target of banner.featured) {
            const targetId = normalizeName(target.name)
            const existing = existingTargetsMap.get(targetId)
            // If target is missing or incomplete, we need the version page
            if (!existing || !existing.attribute || !existing.specialty) {
              versionsToFetch.add(banner.version)
              break
            }
          }
        }
      }
    }

    console.log(`Need to fetch ${versionsToFetch.size} version pages out of ${allVersions.length} total versions.`)

    // 3. Fetch and Parse Version Pages
    const versionDataMap: VersionDataMap = new Map()
    const versionsList = Array.from(versionsToFetch)

    // Fetch in chunks of 3 to avoid rate limits
    const VERSION_CHUNK_SIZE = 3
    for (let i = 0; i < versionsList.length; i += VERSION_CHUNK_SIZE) {
      const chunk = versionsList.slice(i, i + VERSION_CHUNK_SIZE)
      await Promise.all(chunk.map(async (version) => {
        try {
          console.log(`Fetching version ${version}...`)
          const versionUrl = `https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Version/${version}&prop=text&format=json`
          const html = await fetchWikiPage(versionUrl)
          const data = parseVersionPage(html)

          for (const [name, info] of data) {
            versionDataMap.set(name, info)
          }
        }
        catch (e) {
          console.error(`Failed to fetch/parse version page for ${version}`, e)
        }
      }))
    }

    let addedCount = 0
    let updatedCount = 0

    // Prepare batch operations
    const bannersToUpsert: any[] = []
    const targetsToUpsert: any[] = []
    const bannerTargetsToInsert: any[] = []

    // Process banners
    console.log('Processing banners and checking R2...')

    // Process in chunks for R2 checks
    const BANNER_CHUNK_SIZE = 5
    for (let i = 0; i < allBanners.length; i += BANNER_CHUNK_SIZE) {
      const chunk = allBanners.slice(i, i + BANNER_CHUNK_SIZE)

      await Promise.all(chunk.map(async (banner) => {
        const existingBanner = existingBannersMap.get(banner.id)

        const bannerData = {
          id: banner.id,
          title: banner.title,
          channelType: banner.channelType,
          startUtc: banner.startUtc,
          endUtc: banner.endUtc,
          version: banner.version,
          updatedAt: Math.floor(Date.now() / 1000), // Always update timestamp (seconds)
        }

        let needsUpdate = false
        if (!existingBanner) {
          addedCount++
          needsUpdate = true
        }
        else if (
          existingBanner.title !== bannerData.title
          || existingBanner.channelType !== bannerData.channelType
          || existingBanner.startUtc !== bannerData.startUtc
          || existingBanner.endUtc !== bannerData.endUtc
          || existingBanner.version !== bannerData.version
        ) {
          updatedCount++
          needsUpdate = true
        }

        if (needsUpdate) {
          bannersToUpsert.push(bannerData)
        }

        for (const [index, target] of banner.featured.entries()) {
          const targetId = normalizeName(target.name)
          const existingTarget = existingTargetsMap.get(targetId)

          const versionInfo = versionDataMap.get(target.name)
          // Use version info if available, otherwise fallback to existing or default
          const rarity = Math.max(target.rarity, versionInfo?.rarity ?? existingTarget?.rarity ?? 0)
          const attribute = versionInfo?.attribute ?? existingTarget?.attribute ?? null
          const specialty = versionInfo?.specialty ?? existingTarget?.specialty ?? null

          let iconPath: string | null = existingTarget?.iconPath || null

          if (target.iconUrl) {
            const r2Key = `icons/${banner.channelType}s/${targetId}.webp`

            if (r2) {
              // Only check R2 if we don't have an icon path, OR if force is true
              const shouldCheckR2 = force || !iconPath

              if (shouldCheckR2) {
                const exists = await checkR2FileExists({ ASSETS_BUCKET: r2 } as any, r2Key)

                if (!exists) {
                  console.log(`Downloading image for ${target.name}...`)
                  const imageBuffer = await downloadImage(target.iconUrl)
                  if (imageBuffer) {
                    const success = await uploadToR2({ ASSETS_BUCKET: r2 } as any, r2Key, imageBuffer, 'image/webp')
                    if (success) {
                      iconPath = r2Key
                    }
                  }
                }
                else {
                  iconPath = r2Key
                }
              }
            }
            else {
              iconPath = r2Key
            }
          }

          targetsToUpsert.push({
            id: targetId,
            displayName: target.name,
            nickname: target.nickname,
            rarity,
            type: banner.channelType,
            attribute,
            specialty,
            iconPath,
            updatedAt: Math.floor(Date.now() / 1000),
          })

          bannerTargetsToInsert.push({
            bannerId: banner.id,
            targetId,
            order: index,
            isFeatured: true,
            alias: target.alias,
          })
        }
      }))
    }

    // Execute DB operations in batches
    console.log(`Upserting ${bannersToUpsert.length} banners...`)
    // D1/SQLite limit is usually high enough for these counts, but chunking is safer
    const DB_CHUNK_SIZE = 10

    for (let i = 0; i < bannersToUpsert.length; i += DB_CHUNK_SIZE) {
      try {
        await db.insert(banners).values(bannersToUpsert.slice(i, i + DB_CHUNK_SIZE)).onConflictDoUpdate({ target: banners.id, set: {
          title: sql`excluded.title`,
          channelType: sql`excluded.channel_type`,
          startUtc: sql`excluded.start_utc`,
          endUtc: sql`excluded.end_utc`,
          version: sql`excluded.version`,
          updatedAt: sql`excluded.updated_at`,
        } }).execute()
      }
      catch (e) {
        console.error('Error upserting banners chunk:', e)
        throw e
      }
    }

    console.log(`Found ${targetsToUpsert.length} targets...`)
    // Deduplicate targets (same target can appear in multiple banners)
    const uniqueTargets = Array.from(new Map(targetsToUpsert.map(t => [t.id, t])).values())

    // Filter out unchanged targets
    const targetsToReallyUpsert = uniqueTargets.filter((t) => {
      const existing = existingTargetsMap.get(t.id)
      if (!existing)
        return true
      return (
        existing.displayName !== t.displayName
        || existing.nickname !== t.nickname
        || existing.rarity !== t.rarity
        || existing.type !== t.type
        || existing.attribute !== t.attribute
        || existing.specialty !== t.specialty
        || existing.iconPath !== t.iconPath
      )
    })

    console.log(`Upserting ${targetsToReallyUpsert.length} targets (filtered from ${uniqueTargets.length})...`)

    for (let i = 0; i < targetsToReallyUpsert.length; i += DB_CHUNK_SIZE) {
      try {
        await db.insert(targets).values(targetsToReallyUpsert.slice(i, i + DB_CHUNK_SIZE)).onConflictDoUpdate({ target: targets.id, set: {
          nickname: sql`excluded.nickname`,
          rarity: sql`excluded.rarity`,
          attribute: sql`excluded.attribute`,
          specialty: sql`excluded.specialty`,
          iconPath: sql`excluded.icon_path`,
          updatedAt: sql`excluded.updated_at`,
        } }).execute()
      }
      catch (e) {
        console.error('Error upserting targets chunk:', e)
        throw e
      }
    }

    console.log(`Inserting ${bannerTargetsToInsert.length} banner targets...`)
    for (let i = 0; i < bannerTargetsToInsert.length; i += DB_CHUNK_SIZE) {
      try {
        await db.insert(bannerTargets).values(bannerTargetsToInsert.slice(i, i + DB_CHUNK_SIZE)).onConflictDoNothing().execute()
      }
      catch (e) {
        console.error('Error inserting banner targets chunk:', e)
        throw e
      }
    }

    await logRunFinish(db, runId, 'success', `Added/Updated ${bannersToUpsert.length} banners, ${uniqueTargets.length} targets`)
    console.log(`Scrape run ${runId} completed successfully`)
    return { added: addedCount, updated: updatedCount }
  }
  catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Scrape run ${runId} failed:`, msg)
    await logRunFinish(db, runId, 'failed', msg)
    throw error
  }
}

async function logRunStart(db: any) {
  const result = await db.insert(scrapeRuns).values({
    startedAt: Date.now(),
    status: 'running',
  }).returning({ id: scrapeRuns.id }).get()
  return result.id
}

async function logRunFinish(db: any, id: number, status: 'success' | 'failed', message: string) {
  await db.update(scrapeRuns).set({
    finishedAt: Date.now(),
    status,
    message,
  }).where(eq(scrapeRuns.id, id)).execute()
}
