import { drizzle } from 'drizzle-orm/d1'
import { scrapeBanners } from './scraper/index'

export default {
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    try {
      ctx.waitUntil(
        (async () => {
          try {
            const db = drizzle(env.DB)
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
      const db = drizzle(env.DB)
      const result = await scrapeBanners(db, env.ASSETS_BUCKET)
      return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
    }
    return new Response('Worker is running.')
  },
}
