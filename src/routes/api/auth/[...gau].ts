import type { APIEvent } from '@solidjs/start/server'
import { SolidAuth } from '@rttnd/gau/solidstart'
import { useAuth } from '~/server/auth'

export async function GET(event: APIEvent) {
  const auth = await useAuth()
  return SolidAuth(auth).GET(event)
}

export async function POST(event: APIEvent) {
  const auth = await useAuth()
  return SolidAuth(auth).POST(event)
}

export async function OPTIONS(event: APIEvent) {
  const auth = await useAuth()
  return SolidAuth(auth).OPTIONS(event)
}
