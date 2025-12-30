import IconAgentRankA from '~/assets/ranks/Icon_Agent_Rank_A.webp'
import IconAgentRankS from '~/assets/ranks/Icon_Agent_Rank_S.webp'
import IconItemRankA from '~/assets/ranks/Icon_Item_Rank_A.webp'
import IconItemRankS from '~/assets/ranks/Icon_Item_Rank_S.webp'
import IconUnknown from '~/assets/Unknown.webp'

export type Attribute = string
export type Specialty = string

export type ChannelType = 'agent' | 'engine'

export interface AgentMeta {
  name: string
  rarity: number
  attribute: Attribute
  specialty: Specialty
  icon: string
}

export interface WEngineMeta {
  name: string
  rarity: number
  specialty: Specialty
  icon: string
}

export interface Banner {
  id: string
  type: ChannelType
  title: string
  start: string // ISO date
  end: string // ISO date
  featured: string // target name
  featuredARanks: string[]
}

export const ICON_AGENT_RANK_S = IconAgentRankS
export const ICON_AGENT_RANK_A = IconAgentRankA
export const ICON_ITEM_RANK_S = IconItemRankS
export const ICON_ITEM_RANK_A = IconItemRankA
export const UNKNOWN_ICON = IconUnknown

function startOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`)
}

function nextDayUtc(dateStr: string): Date {
  const d = startOfDayUtc(dateStr)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

export function isBannerActive(b: Banner, now: Date = new Date()): boolean {
  const start = startOfDayUtc(b.start)
  const endExcl = nextDayUtc(b.end)
  return now >= start && now < endExcl
}

export function isBannerPast(b: Banner, now: Date = new Date()): boolean {
  const endExcl = nextDayUtc(b.end)
  return now >= endExcl
}

export function isBannerUpcoming(b: Banner, now: Date = new Date()): boolean {
  const start = startOfDayUtc(b.start)
  return now < start
}
