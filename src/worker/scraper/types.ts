export interface ScrapedBanner {
  id: string
  title: string
  channelType: 'agent' | 'engine'
  startUtc: number
  endUtc: number
  version: string
  featured: ScrapedTarget[]
}

export interface ScrapedTarget {
  name: string
  nickname: string | null
  alias: string | null
  iconUrl: string | null
  rarity: number // 5 = S, 4 = A, 3 = B
  isFeatured: boolean
  attribute?: string | null
  specialty?: string | null
}

export interface VersionData {
  attribute?: string
  attributeIconUrl?: string
  specialty?: string
  specialtyIconUrl?: string
  rarity?: number
}

export interface MetaEntry {
  name: string
  iconUrl: string
}

export interface Env {
  DB: D1Database
  ASSETS_BUCKET: R2Bucket
}

export type VersionDataMap = Map<string, VersionData>
