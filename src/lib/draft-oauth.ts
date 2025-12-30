import type { ChannelType } from '~/lib/constants'

export const DRAFT_OAUTH_IMPORT_KEY = 'draft:oauth-import' as const

export interface DraftOAuthTarget {
  id: string
  targetId: string
  channelType: ChannelType
  order: number
}

export interface DraftOAuthPayload {
  name: string
  targets: DraftOAuthTarget[]
  createdAt: number
}

function isBrowser() {
  return typeof window !== 'undefined'
}

export function stashDraftOAuthImport(input: {
  name: string
  targets: DraftOAuthTarget[]
}) {
  if (!isBrowser())
    return

  const payload: DraftOAuthPayload = {
    name: input.name,
    targets: input.targets.map((t, i) => ({
      id: t.id,
      targetId: String(t.targetId),
      channelType: t.channelType,
      order: typeof t.order === 'number' ? t.order : i,
    })),
    createdAt: Date.now(),
  }

  const raw = JSON.stringify(payload)

  try {
    window.sessionStorage.setItem(DRAFT_OAUTH_IMPORT_KEY, raw)
  }
  catch {}
}

export function loadDraftOAuthImport(): { name?: string, targets: DraftOAuthTarget[] } | null {
  if (!isBrowser())
    return null

  let raw: string | null = null
  try {
    raw = window.sessionStorage.getItem(DRAFT_OAUTH_IMPORT_KEY)
  }
  catch {}
  if (!raw)
    return null

  try {
    const parsed = JSON.parse(raw) as any
    if (!parsed || !Array.isArray(parsed.targets))
      return null

    const targets: DraftOAuthTarget[] = parsed.targets
      .filter((t: any) =>
        t
        && typeof t.targetId === 'string'
        && (t.channelType === 'agent' || t.channelType === 'engine'),
      )
      .map((t: any, i: number) => ({
        id: typeof t.id === 'string' ? t.id : crypto.randomUUID(),
        targetId: t.targetId,
        channelType: t.channelType,
        order: typeof t.order === 'number' ? t.order : i,
      }))

    return {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      targets,
    }
  }
  catch {
    return null
  }
}

export function clearDraftOAuthImport() {
  if (!isBrowser())
    return
  try {
    window.sessionStorage.removeItem(DRAFT_OAUTH_IMPORT_KEY)
  }
  catch {}
}
