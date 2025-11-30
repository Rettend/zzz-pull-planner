import type { ScrapedBanner } from '../types'
import { load } from 'cheerio'
import { getBannerId, parseDate } from '../../../lib/utils'

export function parseHistoryPage(html: string, type: 'agent' | 'engine'): ScrapedBanner[] {
  const $ = load(html)
  const rows = $('table.article-table tbody tr').toArray()

  // Skip header
  rows.shift()

  return rows.map((row, i) => {
    const cols = $(row).find('td')
    if (cols.length < 5)
      return null

    // Column 0: Banner Name
    let name = $(cols[0]).find('a').first().text().trim()
    if (!name) {
      // Fallback: try to get name from the first featured item if banner name is missing
      const firstCard = $(cols[1]).find('.card-container').first()
      const fallbackName = firstCard.find('.card-link a').text().trim() || firstCard.find('.card-label').text().trim()
      if (fallbackName) {
        name = `${fallbackName} Banner`
      }
      else {
        name = $(cols[0]).text().trim()
      }
    }

    // Column 2 & 3: Dates (Use data-sort-value if available for better precision)
    const startStr = $(cols[2]).attr('data-sort-value') || $(cols[2]).text().trim()
    const endStr = $(cols[3]).attr('data-sort-value') || $(cols[3]).text().trim()

    // Column 4: Version
    const version = $(cols[4]).text().trim()

    if (!name || !startStr || !endStr) {
      console.error(`Skipping row ${i}: Missing name or dates`, { name, startStr, endStr })
      return null
    }

    try {
      const start = parseDate(startStr)
      const end = parseDate(endStr)

      const id = getBannerId(name, start)

      // Column 1: Featured Targets
      const targets: any[] = []
      $(cols[1]).find('.card-container').each((_, el) => {
        const card = $(el)
        const targetName = card.find('.card-link a').text().trim() || card.find('.card-label').text().trim()
        let img = card.find('img').attr('data-src') || card.find('img').attr('src')
        if (img) {
          // Remove scaling and query params to get full resolution
          // e.g. .../scale-to-width-down/50?cb=... -> .../
          img = img.split('/scale-to-width-down/')[0]
        }

        // Determine rarity from class (e.g. card-rank-S)
        let rarity = 4 // Default to A-rank (4 stars)
        // Check for S-rank class on the card container
        if (card.hasClass('card-rank-S')) {
          rarity = 5
        }
        // Also check for B-rank
        if (card.hasClass('card-rank-B')) {
          rarity = 3
        }

        const nickname = card.find('.card-label').text().trim() || null

        if (targetName) {
          targets.push({
            name: targetName,
            nickname,
            alias: null,
            iconUrl: img,
            rarity,
            isFeatured: true,
          })
        }
      })

      return {
        id,
        title: name,
        channelType: type,
        startUtc: Math.floor(start.getTime() / 1000),
        endUtc: Math.floor(end.getTime() / 1000),
        version,
        featured: targets,
      }
    }
    catch (e) {
      console.error(`Skipping row ${i}: Date parse error for "${startStr} - ${endStr}"`, e)
      return null
    }
  }).filter(Boolean) as ScrapedBanner[]
}
