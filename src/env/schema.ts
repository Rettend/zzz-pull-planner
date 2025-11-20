import { z } from 'zod'

export const serverScheme = z.object({
  DATABASE_URL: z.string(),
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  CLOUDFLARE_DATABASE_ID: z.string(),
  CLOUDFLARE_D1_TOKEN: z.string(),
})

export const clientScheme = z.object({
  VITE_R2_PUBLIC_URL: z.string(),
})

export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined>,
  context: string,
): z.infer<T> {
  const result = schema.safeParse(env)

  if (!result.success) {
    console.error(z.prettifyError(result.error))
    throw new Error(`Invalid ${context} environment variables`)
  }

  return result.data
}
