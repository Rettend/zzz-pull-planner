import type { VersionDataMap } from './types'
import { eq } from 'drizzle-orm'

import { banners, bannerTargets, scrapeRuns, targets } from '../../db/schema'
import { normalizeName } from '../../lib/utils'
import { downloadImage, fetchWikiPage } from './fetch'
import { parseHistoryPage } from './parsers/history'
import { parseVersionPage } from './parsers/version'
import { checkR2FileExists, uploadToR2 } from './r2'

const AGENT_HISTORY_URL = 'https://zenless-zone-zero.fandom.com/api.php?action=parse&page=Exclusive_Channel/History&prop=text&format=json'
const ENGINE_HISTORY_URL = 'https://zenless-zone-zero.fandom.com/api.php?action=parse&page=W-Engine_Channel/History&prop=text&format=json'

export async function scrapeBanners(db: any, r2?: R2Bucket) {
  const runId = await logRunStart(db)

  try {
    // 1. Fetch and Parse History Pages
    const [agentData, engineData] = await Promise.all([
      fetchWikiPage(AGENT_HISTORY_URL),
      fetchWikiPage(ENGINE_HISTORY_URL),
    ])

    const agentBanners = parseHistoryPage(agentData, 'agent')
    const engineBanners = parseHistoryPage(engineData, 'engine')
    const allBanners = [...agentBanners, ...engineBanners]

    // 2. Fetch and Parse Version Pages
    const versions = new Set(allBanners.map(b => b.version))
    const versionDataMap: VersionDataMap = new Map()

    for (const version of versions) {
      try {
        if (!/^\d+\.\d+$/.test(version))
          continue

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
    }

    let addedCount = 0
    let updatedCount = 0

    for (const banner of allBanners) {
      const existingBanner = await db.select().from(banners).where(eq(banners.id, banner.id)).get()

      const bannerData = {
        id: banner.id,
        title: banner.title,
        channelType: banner.channelType,
        startUtc: banner.startUtc,
        endUtc: banner.endUtc,
        version: banner.version,
      }

      if (!existingBanner) {
        await db.insert(banners).values(bannerData).execute()
        addedCount++
      }
      else {
        await db.update(banners).set(bannerData).where(eq(banners.id, banner.id)).execute()
        updatedCount++
      }

      for (const [index, target] of banner.featured.entries()) {
        const targetId = normalizeName(target.name)
        const existingTarget = await db.select().from(targets).where(eq(targets.id, targetId)).get()

        const versionInfo = versionDataMap.get(target.name)
        const rarity = versionInfo?.rarity ?? target.rarity
        const attribute = versionInfo?.attribute ?? null
        const specialty = versionInfo?.specialty ?? null
        let iconPath = existingTarget?.iconPath || target.iconUrl

        if (target.iconUrl && r2) {
          const ext = target.iconUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || 'png'
          const safeExt = ext === 'webp' ? 'webp' : 'png'
          const contentType = safeExt === 'webp' ? 'image/webp' : 'image/png'
          const r2Key = `icons/${banner.channelType}s/${targetId}.${safeExt}`

          const exists = await checkR2FileExists({ ASSETS_BUCKET: r2 } as any, r2Key)

          if (!exists) {
            // eslint-disable-next-line no-console
            console.log(`Downloading image for ${target.name}...`)
            const imageBuffer = await downloadImage(target.iconUrl)
            if (imageBuffer) {
              const success = await uploadToR2({ ASSETS_BUCKET: r2 } as any, r2Key, imageBuffer, contentType)
              if (success) {
                iconPath = r2Key
              }
            }
          }
          else {
            iconPath = r2Key
          }
        }

        if (!existingTarget) {
          await db.insert(targets).values({
            id: targetId,
            displayName: target.name,
            rarity,
            type: banner.channelType,
            attribute,
            specialty,
            iconPath,
            updatedAt: Date.now(),
          }).execute()
        }
        else {
          await db.update(targets).set({
            rarity,
            attribute: attribute || existingTarget.attribute,
            specialty: specialty || existingTarget.specialty,
            iconPath,
            updatedAt: Date.now(),
          }).where(eq(targets.id, targetId)).execute()
        }

        await db.insert(bannerTargets).values({
          bannerId: banner.id,
          targetId,
          order: index,
          isFeatured: true,
          alias: target.alias,
        }).onConflictDoNothing().execute()
      }
    }

    await logRunFinish(db, runId, 'success', `Added ${addedCount}, Updated ${updatedCount}`)
    return { added: addedCount, updated: updatedCount }
  }
  catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
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
