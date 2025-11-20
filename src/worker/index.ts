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

  async fetch(_request: Request, _env: any, _ctx: ExecutionContext) {
    return new Response('Worker is running.')
  },
}
