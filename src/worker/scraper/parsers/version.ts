import type { MetaEntry, VersionDataMap } from '../types'
import { load } from 'cheerio'

export interface VersionParseResult {
  agents: VersionDataMap
  attributes: MetaEntry[]
  specialties: MetaEntry[]
}

function cleanImageUrl(url: string): string {
  if (!url)
    return url
  let cleaned = url.replace(/\/scale-to-width-down\/\d+/, '')
  const queryIndex = cleaned.indexOf('?')
  if (queryIndex !== -1)
    cleaned = cleaned.slice(0, queryIndex)

  return cleaned
}

export function parseVersionPage(html: string): VersionParseResult {
  const $ = load(html)
  const data: VersionDataMap = new Map()
  const attributesMap = new Map<string, string>()
  const specialtiesMap = new Map<string, string>()

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

    // Attribute
    let attribute = ''
    let attributeIconUrl = ''
    const attrEl = li.find('[class^="text-"]')
    if (attrEl.length) {
      // Filter out text-menu which is used for Specialty
      const attrCandidates = attrEl.filter((i, e) => {
        const cls = $(e).attr('class') || ''
        return !cls.includes('text-menu')
      })
      attribute = attrCandidates.first().text().trim()

      // Find the attribute icon (the img before the text element)
      const attrImg = attrCandidates.first().parent().find('img[alt*="Icon"]').first()
      if (attrImg.length)
        attributeIconUrl = attrImg.attr('data-src') || attrImg.attr('src') || ''

      // Track unique attributes with their icons
      if (attribute && attributeIconUrl && !attributesMap.has(attribute))
        attributesMap.set(attribute, attributeIconUrl)
    }

    // Specialty
    const specialty = li.find('.text-menu').text().trim()
    let specialtyIconUrl = ''

    // Find specialty icon
    if (specialty) {
      const specImg = li.find('img').filter((_, img) => {
        const alt = $(img).attr('alt') || ''
        return alt.includes('Icon') && alt.includes(specialty)
      }).first()
      if (specImg.length)
        specialtyIconUrl = specImg.attr('data-src') || specImg.attr('src') || ''
    }

    // Track unique specialties with their icons
    if (specialty && specialtyIconUrl && !specialtiesMap.has(specialty))
      specialtiesMap.set(specialty, specialtyIconUrl)

    if (name) {
      data.set(name, {
        rarity,
        attribute: attribute || undefined,
        attributeIconUrl: attributeIconUrl ? cleanImageUrl(attributeIconUrl) : undefined,
        specialty: specialty || undefined,
        specialtyIconUrl: specialtyIconUrl ? cleanImageUrl(specialtyIconUrl) : undefined,
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
    let specialtyIconUrl = ''

    // Find specialty icon
    if (specialty) {
      const specImg = li.find('img').filter((_, img) => {
        const alt = $(img).attr('alt') || ''
        return alt.includes('Icon') && alt.includes(specialty)
      }).first()
      if (specImg.length)
        specialtyIconUrl = specImg.attr('data-src') || specImg.attr('src') || ''
    }

    if (specialty && specialtyIconUrl && !specialtiesMap.has(specialty))
      specialtiesMap.set(specialty, specialtyIconUrl)

    if (name) {
      data.set(name, {
        rarity,
        specialty: specialty || undefined,
        specialtyIconUrl: specialtyIconUrl ? cleanImageUrl(specialtyIconUrl) : undefined,
      })
    }
  })

  return {
    agents: data,
    attributes: Array.from(attributesMap.entries()).map(([name, iconUrl]) => ({ name, iconUrl: cleanImageUrl(iconUrl) })),
    specialties: Array.from(specialtiesMap.entries()).map(([name, iconUrl]) => ({ name, iconUrl: cleanImageUrl(iconUrl) })),
  }
}
