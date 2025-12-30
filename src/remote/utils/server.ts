import type { User } from '@rttnd/gau'
import { redirect } from '@solidjs/router'
import { getRequestEvent } from 'solid-js/web'
import { useDb } from '~/db/client'

export async function requireUser(): Promise<User> {
  const event = getRequestEvent()
  if (!event)
    throw new Error('No request context')

  const session = await event.locals.getSession()
  if (!session?.user)
    throw redirect('/')

  return session.user
}

export async function optionalUser(): Promise<User | null> {
  const event = getRequestEvent()
  if (!event)
    return null

  const session = await event.locals.getSession()
  return session?.user ?? null
}

export async function requireDb() {
  const db = await useDb()
  if (!db)
    throw new Error('Database not available')
  return db
}

export async function optionalDb() {
  const db = await useDb()
  return db ?? null
}
