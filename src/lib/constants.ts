import IconAgentRankA from '~/assets/ranks/Icon_Agent_Rank_A.webp'
import IconAgentRankS from '~/assets/ranks/Icon_Agent_Rank_S.webp'
import IconItemRankA from '~/assets/ranks/Icon_Item_Rank_A.webp'
import IconItemRankS from '~/assets/ranks/Icon_Item_Rank_S.webp'
import IconUnknown from '~/assets/Unknown.webp'
import { resolveAttributeIconByName, resolveSpecialtyIconByName } from '../utils/assets'

export type Attribute = 'Physical' | 'Fire' | 'Ice' | 'Electric' | 'Ether' | 'Frost' | 'Auric Ink'
export type Specialty = 'Attack' | 'Anomaly' | 'Rupture' | 'Stun' | 'Support' | 'Defense'

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

export const ATTRIBUTE_ICON: Record<Attribute, string> = {
  'Physical': resolveAttributeIconByName('Physical'),
  'Fire': resolveAttributeIconByName('Fire'),
  'Ice': resolveAttributeIconByName('Ice'),
  'Electric': resolveAttributeIconByName('Electric'),
  'Ether': resolveAttributeIconByName('Ether'),
  'Frost': resolveAttributeIconByName('Frost'),
  'Auric Ink': resolveAttributeIconByName('Auric Ink'),
}

export const SPECIALTY_ICON: Record<Specialty, string> = {
  Anomaly: resolveSpecialtyIconByName('Anomaly'),
  Attack: resolveSpecialtyIconByName('Attack'),
  Defense: resolveSpecialtyIconByName('Defense'),
  Rupture: resolveSpecialtyIconByName('Rupture'),
  Stun: resolveSpecialtyIconByName('Stun'),
  Support: resolveSpecialtyIconByName('Support'),
}

export const ICON_AGENT_RANK_S = IconAgentRankS
export const ICON_AGENT_RANK_A = IconAgentRankA
export const ICON_ITEM_RANK_S = IconItemRankS
export const ICON_ITEM_RANK_A = IconItemRankA
export const UNKNOWN_ICON = IconUnknown

export function resolveAttributeIcon(attr?: Attribute): string {
  return attr ? (ATTRIBUTE_ICON[attr] ?? UNKNOWN_ICON) : UNKNOWN_ICON
}

export function resolveSpecialtyIcon(spec?: Specialty): string {
  return spec ? (SPECIALTY_ICON[spec] ?? UNKNOWN_ICON) : UNKNOWN_ICON
}

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
