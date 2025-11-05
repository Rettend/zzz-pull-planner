import IconRankS from '~/assets/Icon_Rank_S.webp'
import IconUnknown from '~/assets/Unknown.webp'
import { resolveAgentIcon, resolveAttributeIconByName, resolveSpecialtyIconByName, resolveWEngineIcon } from '../utils/assets'

export type Attribute = 'Physical' | 'Fire' | 'Ice' | 'Electric' | 'Ether' | 'Frost' | 'Auric Ink'
export type Specialty = 'Attack' | 'Anomaly' | 'Rupture' | 'Stun' | 'Support' | 'Defense'

export type ChannelType = 'agent' | 'engine'

export interface AgentMeta {
  name: string
  attribute: Attribute
  specialty: Specialty
  icon: string
}

export interface WEngineMeta {
  name: string
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

export const RANK_S_ICON = IconRankS
export const UNKNOWN_ICON = IconUnknown

export const AGENTS: Record<string, AgentMeta> = {
  'Lucia': {
    name: 'Lucia',
    attribute: 'Ether',
    specialty: 'Support',
    icon: resolveAgentIcon('Lucia'),
  },
  'Vivian': {
    name: 'Vivian',
    attribute: 'Ether',
    specialty: 'Anomaly',
    icon: resolveAgentIcon('Vivian'),
  },
  'Ju Fufu': {
    name: 'Ju Fufu',
    attribute: 'Fire',
    specialty: 'Stun',
    icon: resolveAgentIcon('Ju Fufu'),
  },
  'Yidhari': {
    name: 'Yidhari',
    attribute: 'Ice',
    specialty: 'Rupture',
    icon: resolveAgentIcon('Yidhari'),
  },
}

export const W_ENGINES: Record<string, WEngineMeta> = {
  'Dreamlit Hearth': {
    name: 'Dreamlit Hearth',
    specialty: 'Support',
    icon: resolveWEngineIcon('Dreamlit Hearth'),
  },
  'Flight of Fancy': {
    name: 'Flight of Fancy',
    specialty: 'Anomaly',
    icon: resolveWEngineIcon('Flight of Fancy'),
  },
  'Kraken\'s Cradle': {
    name: 'Kraken\'s Cradle',
    specialty: 'Rupture',
    icon: resolveWEngineIcon('Krakens Cradle'),
  },
  'Roaring Fur-nace': {
    name: 'Roaring Fur-nace',
    specialty: 'Stun',
    icon: resolveWEngineIcon('Roaring Fur-nace'),
  },
}

export const BANNERS: Banner[] = [
  // Version 2.3 I
  { id: 'wandering-night-lantern', type: 'agent', title: 'Wandering Night Lantern', start: '2025-10-15', end: '2025-11-05', featured: 'Lucia' },
  { id: 'soar-into-the-gentle-night', type: 'agent', title: 'Soar Into the Gentle Night', start: '2025-10-15', end: '2025-11-05', featured: 'Vivian' },
  { id: 'dissonant-sonata', type: 'engine', title: 'Dissonant Sonata', start: '2025-10-15', end: '2025-11-05', featured: 'Dreamlit Hearth' },
  { id: 'vibrant-resonance', type: 'engine', title: 'Vibrant Resonance', start: '2025-10-15', end: '2025-11-05', featured: 'Flight of Fancy' },

  // Version 2.3 II
  { id: 'alone-in-a-shared-dream', type: 'agent', title: 'Alone in a Shared Dream', start: '2025-11-05', end: '2025-11-25', featured: 'Yidhari' },
  { id: 'fu-rocious-feline', type: 'agent', title: 'Fu-rocious Feline', start: '2025-11-05', end: '2025-11-25', featured: 'Ju Fufu' },
  { id: 'dazzling-choir', type: 'engine', title: 'Dazzling Choir', start: '2025-11-05', end: '2025-11-25', featured: 'Kraken\'s Cradle' },
  { id: 'dazzling-melody', type: 'engine', title: 'Dazzling Melody', start: '2025-11-05', end: '2025-11-25', featured: 'Roaring Fur-nace' },
]

export function resolveAgent(name: string): AgentMeta | undefined {
  return AGENTS[name]
}

export function resolveWEngine(name: string): WEngineMeta | undefined {
  return W_ENGINES[name]
}

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

export function listActiveBanners(now: Date = new Date()): Banner[] {
  return BANNERS.filter(b => isBannerActive(b, now))
}

export function isBannerPast(b: Banner, now: Date = new Date()): boolean {
  const endExcl = nextDayUtc(b.end)
  return now >= endExcl
}

export function isBannerUpcoming(b: Banner, now: Date = new Date()): boolean {
  const start = startOfDayUtc(b.start)
  return now < start
}
