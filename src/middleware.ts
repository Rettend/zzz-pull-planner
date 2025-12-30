import { authMiddleware, refreshMiddleware } from '@rttnd/gau/solidstart'
import { createMiddleware } from '@solidjs/start/middleware'
import { useDb } from './db/client'
import { useAuth } from './server/auth'

export default createMiddleware({
  onRequest: [
    async (event) => {
      const db = await useDb()
      if (!db) {
        // @ts-expect-error idk, for prerendering
        event.locals.getSession = async () => null
        return
      }

      const auth = await useAuth()

      await authMiddleware(true, auth)(event)
      await refreshMiddleware(auth, { threshold: 0.2 })(event)
    },
  ],
})
