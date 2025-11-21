import process from 'node:process'
import { defineConfig } from 'drizzle-kit'
import { parseEnv, serverScheme } from './src/env/schema'

const serverEnv = parseEnv(serverScheme, process.env, 'server')

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: serverEnv.CLOUDFLARE_ACCOUNT_ID,
    databaseId: serverEnv.CLOUDFLARE_DATABASE_ID,
    token: serverEnv.CLOUDFLARE_D1_TOKEN,
  },
  out: 'drizzle',
})
