import { drizzle } from 'drizzle-orm/d1'
import { getRequestEvent } from 'solid-js/web'
import * as schema from './schema'

export async function useDb() {
  if (import.meta.env.DEV) {
    const { Database } = await import('bun:sqlite')
    const { drizzle: drizzleSqlite } = await import('drizzle-orm/bun-sqlite')
    const sqlite = new Database('local.db')
    return drizzleSqlite(sqlite, { schema })
  }

  const event = getRequestEvent()
  if (!event) {
    throw new Error('useDb must be called within a request handler')
  }

  const db = event.nativeEvent.context.cloudflare?.env?.DB
  if (!db) {
    console.error('DB binding not found in context:', event.nativeEvent.context)
    throw new Error('DB binding not available in cloudflare context')
  }

  return drizzle(db, { schema })
}
