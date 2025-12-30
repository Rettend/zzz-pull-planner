import { z } from 'zod'

export const idSchema = z.string().min(1)

export function parse<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  context: string,
): z.infer<T> {
  const result = schema.safeParse(raw)

  if (!result.success) {
    console.error(`[${context}] Invalid input`)
    console.error(z.prettifyError(result.error))
    throw new Error(`Invalid input (${context})`)
  }

  return result.data
}
