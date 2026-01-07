import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../db/schema'
import { scrapeBanners } from './scraper/index'

function useDb(d1: D1Database) {
  return drizzle(d1, { schema, casing: 'snake_case' })
}

export default {
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    try {
      ctx.waitUntil(
        (async () => {
          try {
            const db = useDb(env.DB)
            await scrapeBanners(db, env.ASSETS_BUCKET)
          }
          catch (e) {
            console.error('Scrape failed inside waitUntil', e)
          }
        })(),
      )
    }
    catch (e) {
      console.error('Scheduled handler failed synchronously', e)
    }
  },

  async fetch(request: Request, env: any, _ctx: ExecutionContext) {
    const url = new URL(request.url)
    if (url.pathname === '/scrape') {
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : url.searchParams.get('token')

      if (!env.SCRAPER_AUTH_TOKEN || token !== env.SCRAPER_AUTH_TOKEN)
        return new Response('Unauthorized', { status: 401 })

      const force = url.searchParams.get('force') === 'true'
      const db = useDb(env.DB)
      const result = await scrapeBanners(db, env.ASSETS_BUCKET, force)
      return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
    }
    return new Response('Worker is running.')
  },
}
