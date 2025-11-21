/* eslint-disable no-console */
import process from 'node:process'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { scrapeBanners } from '../src/worker/scraper/index'

console.log('Seeding local database...')

const sqlite = new Database('drizzle/local.db')
const db = drizzle(sqlite)

try {
  const result = await scrapeBanners(db, undefined)
  console.log('Seed completed successfully:', result)
}
catch (e) {
  console.error('Seed failed:', e)
  process.exit(1)
}
