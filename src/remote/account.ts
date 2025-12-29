import { action } from '@solidjs/router'
import { and, eq } from 'drizzle-orm'
import { getRequestEvent } from 'solid-js/web'
import { z } from 'zod'
import { accounts, users } from '~/db/schema'
import { requireDb } from '~/remote/utils/server'
import { parse } from '~/utils'

const deleteAccountSchema = z.object({
  type: z.enum(['guest']),
})
type DeleteAccountInput = z.infer<typeof deleteAccountSchema>

const deleteAccountId = 'account:delete'

/**
 * Deletes the currently-authenticated account.
 *
 * Today we only support deleting `type: 'guest'` accounts (no linked providers).
 * This is intentionally parameterized so we can add a "delete my account" flow later.
 */
export const deleteAccount = action(async (raw: DeleteAccountInput): Promise<void> => {
  'use server'
  const event = getRequestEvent()
  if (!event)
    throw new Error('No request context')

  const input = parse(deleteAccountSchema, raw, deleteAccountId)

  const session = await event.locals.getSession()
  const userId = session?.user?.id
  if (!userId)
    throw new Error('Not signed in')

  const db = await requireDb()

  if (input.type === 'guest') {
    // Must be a guest in our DB
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.isGuest, true)),
    })
    if (!user)
      throw new Error('Not a guest account')

    // Guests can "upgrade" by linking a provider; don't allow deletion once linked.
    const linked = await db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
    })
    if (linked.length > 0)
      throw new Error('Account has linked providers')

    // Cascade deletes: accounts, profiles, profile_targets (via FKs)
    await db.delete(users).where(eq(users.id, userId))
    return
  }

  throw new Error('Unsupported delete type')
}, deleteAccountId)
