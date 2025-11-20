import type { VersionDataMap } from '../types'
import { load } from 'cheerio'

export function parseVersionPage(html: string): VersionDataMap {
  const $ = load(html)
  const data: VersionDataMap = new Map()

  // 1. Playable Agents
  const agentsHeader = $('#Playable_Agents').parent()
  const agentsList = agentsHeader.next('ul')

  agentsList.find('li').each((_, el) => {
    const li = $(el)
    const name = li.find('.item.agent .item-text a').text().trim()
    if (!name)
      return

    let rarity = 4 // Default A
    const rankImg = li.find('img[alt*="Rank"]').attr('alt') || ''
    if (rankImg.includes('S-Rank'))
      rarity = 5
    else if (rankImg.includes('A-Rank'))
      rarity = 4

    // Attribute (Ice, Fire, etc.)
    // Look for the element with class text-ice, text-fire, etc.
    let attribute = ''
    const attrEl = li.find('[class^="text-"]')
    if (attrEl.length) {
      // Filter out text-menu which is used for Specialty
      const attrCandidates = attrEl.filter((i, e) => {
        const cls = $(e).attr('class') || ''
        return !cls.includes('text-menu')
      })
      attribute = attrCandidates.first().text().trim()
    }

    // Specialty (Support, Attack, etc.)
    // Usually has class text-menu
    const specialty = li.find('.text-menu').text().trim()

    if (name) {
      data.set(name, {
        rarity,
        attribute: attribute || undefined,
        specialty: specialty || undefined,
      })
    }
  })

  // 2. W-Engines
  const enginesHeader = $('#W-Engines').parent()
  const enginesList = enginesHeader.next('ul')

  enginesList.find('li').each((_, el) => {
    const li = $(el)
    const name = li.find('.item.w-engine .item-text a').text().trim()
    if (!name)
      return

    let rarity = 4 // Default A
    const rankImg = li.find('img[alt*="Rank"]').attr('alt') || ''
    if (rankImg.includes('S-Rank'))
      rarity = 5
    else if (rankImg.includes('A-Rank'))
      rarity = 4

    // W-Engines don't have Attribute, only Specialty
    const specialty = li.find('.text-menu').text().trim()

    if (name) {
      data.set(name, {
        rarity,
        specialty: specialty || undefined,
      })
    }
  })

  return data
}
