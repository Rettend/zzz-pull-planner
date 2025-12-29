import { DrizzleAdapter } from '@rttnd/gau/adapters/drizzle'
import { createAuth } from '@rttnd/gau/core'
import { Discord, Google } from '@rttnd/gau/oauth'
import { useDb } from '~/db/client'
import { accounts, users } from '~/db/schema'
import { serverEnv } from '~/env/server'

let _auth: ReturnType<typeof createAuth> | null = null

export async function useAuth() {
  if (_auth)
    return _auth

  const db = await useDb()
  if (!db)
    throw new Error('Database not available')

  _auth = createAuth({
    adapter: DrizzleAdapter(db, users, accounts),
    updateUserInfoOnLink: true,
    providers: [
      Google({
        clientId: serverEnv.GOOGLE_CLIENT_ID,
        clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
      }),
      Discord({
        clientId: serverEnv.DISCORD_CLIENT_ID,
        clientSecret: serverEnv.DISCORD_CLIENT_SECRET,
      }),
    ],
    jwt: {
      secret: serverEnv.AUTH_SECRET,
      ttl: 60 * 60 * 24 * 365, // 1 year
    },
  })
  return _auth
}

export type Auth = Awaited<ReturnType<typeof useAuth>>
