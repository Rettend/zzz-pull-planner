import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'drizzle/local.db',
  },
  out: 'drizzle',
  casing: 'snake_case',
})
