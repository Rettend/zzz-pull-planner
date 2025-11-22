import { drizzle } from 'drizzle-orm/d1'
import { getRequestEvent } from 'solid-js/web'
import * as schema from './schema'

export async function useDb() {
  if (import.meta.env.DEV) {
    const { default: Database } = await import('better-sqlite3')
    const { drizzle: drizzleSqlite } = await import('drizzle-orm/better-sqlite3')
    const sqlite = new Database('drizzle/local.db')
    return drizzleSqlite(sqlite, { schema })
  }

  const event = getRequestEvent()
  if (!event) {
    throw new Error('useDb must be called within a request handler')
  }

  const db = event.nativeEvent.context.cloudflare?.env?.DB
  if (!db) {
    console.warn('DB binding not found in context, returning undefined')
    return undefined
  }

  return drizzle(db, { schema })
}
