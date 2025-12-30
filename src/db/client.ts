import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { drizzle } from 'drizzle-orm/d1'
import { getRequestEvent } from 'solid-js/web'
import * as schema from '.'

let _devDb: BetterSQLite3Database<typeof schema> | null = null

export async function useDb() {
  if (import.meta.env.DEV) {
    if (_devDb)
      return _devDb

    const { default: Database } = await import('better-sqlite3')
    const { drizzle: drizzleSqlite } = await import('drizzle-orm/better-sqlite3')
    const sqlite = new Database('drizzle/local.db')

    _devDb = drizzleSqlite(sqlite, { schema, casing: 'snake_case' })
    return _devDb
  }

  const event = getRequestEvent()
  if (!event) {
    console.warn('useDb: No request context')
    return undefined
  }

  const db = event.nativeEvent.context.cloudflare?.env?.DB
  if (!db) {
    console.error('DB binding not found in context, returning undefined')
    return undefined
  }

  return drizzle(db, { schema, casing: 'snake_case' })
}
