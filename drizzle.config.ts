import process from 'node:process'
import { defineConfig } from 'drizzle-kit'
import { parseEnv, serverScheme } from './src/env/schema'

const serverEnv = parseEnv(serverScheme, process.env, 'server')
const schema = './src/db/schema.ts'

const devConfig = {
  schema,
  dialect: 'sqlite' as const,
  driver: 'turso' as const,
  dbCredentials: {
    url: serverEnv.DATABASE_URL || 'file:drizzle/local.db',
  },
}

const prodConfig = {
  schema,
  dialect: 'sqlite' as const,
  driver: 'd1-http' as const,
  dbCredentials: {
    accountId: serverEnv.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: serverEnv.CLOUDFLARE_DATABASE_ID!,
    token: serverEnv.CLOUDFLARE_D1_TOKEN!,
  },
}

export default defineConfig(import.meta.env.PROD ? prodConfig : devConfig)
