import type { PlannerInputsData, ProfileData, ProfileSettingsData } from '~/types/profile'
import { action, query } from '@solidjs/router'
import { eq } from 'drizzle-orm'
import { getRequestEvent } from 'solid-js/web'
import { z } from 'zod'
import { profiles, profileSettings, profileTargets, users } from '~/db/schema'
import { optionalUser, requireDb, requireUser } from '~/remote/utils/server'
import { idSchema, parse } from '~/utils'

// #region Schemas
const channelTypeSchema = z.enum(['agent', 'engine'])
const profileTargetSchema = z.object({
  targetId: idSchema, // targets.id is a slug, but our ids are all strings
  channelType: channelTypeSchema,
  count: z.number().int().min(0),
  order: z.number().int().min(0).optional(),
})

const scenarioSchema = z.enum(['p50', 'p60', 'p75', 'p90', 'ev'])
const planningModeSchema = z.enum(['s-rank', 'a-rank'])
const luckModeSchema = z.enum(['best', 'realistic', 'worst'])

const plannerInputsSchema: z.ZodType<PlannerInputsData> = z.object({
  N: z.number().int().min(0),
  pullsOnHand: z.number().int().min(0),
  incomes: z.array(z.number().int().min(0)),
  pityAgentStart: z.number().int().min(0),
  guaranteedAgentStart: z.boolean(),
  pityEngineStart: z.number().int().min(0),
  guaranteedEngineStart: z.boolean(),
  pityAgentStartA: z.number().int().min(0).optional(),
  guaranteedAgentStartA: z.boolean().optional(),
  pityEngineStartA: z.number().int().min(0).optional(),
  guaranteedEngineStartA: z.boolean().optional(),
  luckMode: luckModeSchema.optional(),
})

const profileSettingsSchema: z.ZodType<ProfileSettingsData> = z.object({
  plannerInputs: plannerInputsSchema,
  scenario: scenarioSchema,
  // JSON object keys are strings; we accept either and normalize later.
  phaseTimings: z.record(z.string(), z.enum(['start', 'end'])),
  planningMode: planningModeSchema,
})

const draftDataSchema = z.object({
  name: z.string().min(1).optional(),
  targets: z.array(profileTargetSchema),
  settings: profileSettingsSchema.optional(),
})

const createProfileSchema = z.object({
  name: z.string().min(1),
})
type CreateProfileInput = z.infer<typeof createProfileSchema>

const updateProfileSchema = z.object({
  profileId: idSchema,
  name: z.string().min(1),
})
type UpdateProfileInput = z.infer<typeof updateProfileSchema>

const deleteProfileSchema = z.object({
  profileId: idSchema,
})
type DeleteProfileInput = z.infer<typeof deleteProfileSchema>

const saveProfileTargetsSchema = z.object({
  profileId: idSchema,
  targets: z.array(profileTargetSchema),
})
type SaveProfileTargetsInput = z.infer<typeof saveProfileTargetsSchema>

const getProfileSchema = z.object({
  profileId: idSchema,
})
type GetProfileInput = z.infer<typeof getProfileSchema>

type PromoteDraftToGuestInput = z.infer<typeof draftDataSchema>
// #endregion

// #region Settings Helpers
function defaultPlannerInputs(): PlannerInputsData {
  return {
    N: 60,
    pullsOnHand: 0,
    incomes: [75, 75, 75, 75],
    pityAgentStart: 0,
    guaranteedAgentStart: false,
    pityEngineStart: 0,
    guaranteedEngineStart: false,
    luckMode: 'realistic',
  }
}

function defaultProfileSettings(): ProfileSettingsData {
  return {
    plannerInputs: defaultPlannerInputs(),
    scenario: 'p60',
    phaseTimings: {},
    planningMode: 's-rank',
  }
}

function safeJsonParse<T>(raw: string | null | undefined): T | null {
  if (!raw)
    return null
  try {
    return JSON.parse(raw) as T
  }
  catch {
    return null
  }
}

function normalizePhaseTimings(input: unknown): Record<number, 'start' | 'end'> {
  if (!input || typeof input !== 'object')
    return {}
  const out: Record<number, 'start' | 'end'> = {}
  for (const [k, v] of Object.entries(input as Record<string, any>)) {
    const idx = Number(k)
    if (!Number.isFinite(idx))
      continue
    if (v === 'start' || v === 'end')
      out[idx] = v
  }
  return out
}

function normalizeSettingsFromDb(row: { plannerInputsJson?: string | null, scenario?: string | null, phaseTimingsJson?: string | null, planningMode?: string | null } | null | undefined): ProfileSettingsData {
  const defaults = defaultProfileSettings()
  if (!row)
    return defaults

  const parsedInputs = safeJsonParse<unknown>(row.plannerInputsJson ?? null)
  const parsedTimings = safeJsonParse<unknown>(row.phaseTimingsJson ?? null)

  const inputs = (() => {
    const candidate = plannerInputsSchema.safeParse(parsedInputs)
    return candidate.success ? candidate.data : defaults.plannerInputs
  })()

  const scenario = scenarioSchema.safeParse(row.scenario).success ? (row.scenario as ProfileSettingsData['scenario']) : defaults.scenario
  const planningMode = planningModeSchema.safeParse(row.planningMode).success ? (row.planningMode as ProfileSettingsData['planningMode']) : defaults.planningMode
  const phaseTimings = normalizePhaseTimings(parsedTimings)

  return { plannerInputs: inputs, scenario, planningMode, phaseTimings }
}

async function upsertProfileSettings(db: any, input: { profileId: string, settings: ProfileSettingsData }) {
  const existing = await db.query.profileSettings.findFirst({
    where: eq(profileSettings.profileId, input.profileId),
  })

  const values = {
    profileId: input.profileId,
    plannerInputsJson: JSON.stringify(input.settings.plannerInputs),
    scenario: input.settings.scenario,
    phaseTimingsJson: JSON.stringify(input.settings.phaseTimings ?? {}),
    planningMode: input.settings.planningMode,
  }

  if (!existing) {
    await db.insert(profileSettings).values(values)
    return
  }

  await db.update(profileSettings)
    .set(values)
    .where(eq(profileSettings.profileId, input.profileId))
}
// #endregion

// #region GET Profiles
const getProfilesId = 'profiles:get'

/**
 * Get all profiles for the current user
 */
export const getProfiles = query(async (): Promise<ProfileData[]> => {
  'use server'
  const user = await optionalUser()
  if (!user)
    return []

  const db = await requireDb()

  const userProfiles = await db.query.profiles.findMany({
    where: eq(profiles.userId, user.id),
    with: {
      profileTargets: true,
      profileSettings: true,
    },
  })

  return userProfiles.map(p => ({
    id: p.id,
    name: p.name,
    targets: p.profileTargets.map(t => ({
      targetId: t.targetId,
      channelType: t.channelType,
      count: t.count,
      order: t.order,
    })),
    settings: normalizeSettingsFromDb(p.profileSettings),
  }))
}, getProfilesId)
// #endregion

// #region GET Profile
const getProfileId = 'profile:get'

/**
 * Get a single profile by ID (must belong to current user)
 */
export const getProfile = query(async (raw: GetProfileInput): Promise<ProfileData | null> => {
  'use server'
  const user = await optionalUser()
  if (!user)
    return null

  const input = parse(getProfileSchema, raw, getProfileId)
  const db = await requireDb()

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, input.profileId),
    with: {
      profileTargets: true,
      profileSettings: true,
    },
  })

  // Ensure profile belongs to user
  if (!profile || profile.userId !== user.id)
    return null

  return {
    id: profile.id,
    name: profile.name,
    targets: profile.profileTargets.map(t => ({
      targetId: t.targetId,
      channelType: t.channelType,
      count: t.count,
      order: t.order,
    })),
    settings: normalizeSettingsFromDb(profile.profileSettings),
  }
}, getProfileId)
// #endregion

// #region CREATE Profile
const createProfileId = 'profile:create'

/**
 * Create a new profile for the current user
 */
export const createProfile = action(async (raw: CreateProfileInput): Promise<string> => {
  'use server'
  const user = await requireUser()
  const input = parse(createProfileSchema, raw, createProfileId)
  const db = await requireDb()

  const [newProfile] = await db.insert(profiles).values({
    userId: user.id,
    name: input.name,
  }).returning()

  // Create default settings row for SSR + cross-device sync.
  await db.insert(profileSettings).values({
    profileId: newProfile.id,
    plannerInputsJson: JSON.stringify(defaultPlannerInputs()),
    scenario: 'p60',
    phaseTimingsJson: JSON.stringify({}),
    planningMode: 's-rank',
  })

  return newProfile.id
}, createProfileId)
// #endregion

// #region UPDATE Profile
const updateProfileId = 'profile:update'

/**
 * Update profile name
 */
export const updateProfile = action(async (raw: UpdateProfileInput): Promise<void> => {
  'use server'
  const user = await requireUser()
  const input = parse(updateProfileSchema, raw, updateProfileId)
  const db = await requireDb()

  // Verify ownership
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, input.profileId),
  })

  if (!profile || profile.userId !== user.id)
    throw new Error('Profile not found')

  await db.update(profiles)
    .set({ name: input.name })
    .where(eq(profiles.id, input.profileId))
}, updateProfileId)
// #endregion

// #region DELETE Profile
const deleteProfileId = 'profile:delete'

/**
 * Delete a profile and all its targets
 */
export const deleteProfile = action(async (raw: DeleteProfileInput): Promise<void> => {
  'use server'
  const user = await requireUser()
  const input = parse(deleteProfileSchema, raw, deleteProfileId)
  const db = await requireDb()

  // Verify ownership
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, input.profileId),
  })

  if (!profile || profile.userId !== user.id)
    throw new Error('Profile not found')

  await db.delete(profiles).where(eq(profiles.id, input.profileId))
}, deleteProfileId)
// #endregion

// #region SAVE Profile Targets
const saveProfileTargetsId = 'profile-targets:save'

/**
 * Replace all targets for a profile (upsert pattern)
 */
export const saveProfileTargets = action(async (raw: SaveProfileTargetsInput): Promise<void> => {
  'use server'
  const user = await requireUser()
  const input = parse(saveProfileTargetsSchema, raw, saveProfileTargetsId)
  const db = await requireDb()

  // Verify ownership
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, input.profileId),
  })

  if (!profile || profile.userId !== user.id)
    throw new Error('Profile not found')

  // Delete existing targets and insert new ones
  await db.delete(profileTargets).where(eq(profileTargets.profileId, input.profileId))

  if (input.targets.length > 0) {
    await db.insert(profileTargets).values(
      input.targets.map((t, i) => ({
        profileId: input.profileId,
        targetId: t.targetId,
        channelType: t.channelType,
        count: t.count,
        order: t.order ?? i,
      })),
    )
  }
}, saveProfileTargetsId)
// #endregion

// #region SAVE Profile Settings
const saveProfileSettingsId = 'profile-settings:save'

const saveProfileSettingsSchema = z.object({
  profileId: idSchema,
  settings: profileSettingsSchema,
})
type SaveProfileSettingsInput = z.infer<typeof saveProfileSettingsSchema>

/**
 * Upsert settings for a profile (must belong to current user)
 */
export const saveProfileSettings = action(async (raw: SaveProfileSettingsInput): Promise<void> => {
  'use server'
  const user = await requireUser()
  const input = parse(saveProfileSettingsSchema, raw, saveProfileSettingsId)
  const db = await requireDb()

  // Verify ownership
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, input.profileId),
  })
  if (!profile || profile.userId !== user.id)
    throw new Error('Profile not found')

  await upsertProfileSettings(db, { profileId: input.profileId, settings: input.settings })
}, saveProfileSettingsId)
// #endregion

// #region PROMOTE Draft to Guest
const promoteDraftToGuestId = 'draft:promote-to-guest'

/**
 * Promote a draft to a guest account.
 * Creates a new user (isGuest=true), a profile, and issues a session.
 */
export const promoteDraftToGuest = action(async (raw: PromoteDraftToGuestInput): Promise<{ profileId: string }> => {
  'use server'
  const event = getRequestEvent()
  if (!event)
    throw new Error('No request context')

  const draftData = parse(draftDataSchema, raw, promoteDraftToGuestId)

  // Check if already logged in
  const existingSession = await event.locals.getSession()
  if (existingSession?.user)
    throw new Error('Already logged in')

  const db = await requireDb()

  const { useAuth } = await import('~/server/auth')
  const auth = await useAuth()

  // 1. Create guest user
  const guestUser = await auth.createUser({
    // Leave name empty, OAuth linking will populate it from the provider.
    name: null,
  })

  // 2. Mark as guest in our custom field
  await db.update(users)
    .set({ isGuest: true })
    .where(eq(users.id, guestUser.id))

  // 3. Create profile
  const [newProfile] = await db.insert(profiles).values({
    userId: guestUser.id,
    name: draftData.name || 'Profile 1',
  }).returning()

  // 3.5 Create profile settings (defaults or provided draft settings)
  const settings = draftData.settings ?? defaultProfileSettings()
  await db.insert(profileSettings).values({
    profileId: newProfile.id,
    plannerInputsJson: JSON.stringify(settings.plannerInputs),
    scenario: settings.scenario,
    phaseTimingsJson: JSON.stringify(settings.phaseTimings ?? {}),
    planningMode: settings.planningMode,
  })

  // 4. Insert draft targets
  if (draftData.targets.length > 0) {
    await db.insert(profileTargets).values(
      draftData.targets.map((t, i) => ({
        profileId: newProfile.id,
        targetId: t.targetId,
        channelType: t.channelType,
        count: t.count,
        order: t.order ?? i,
      })),
    )
  }

  // 5. Issue session using Gau's issueSession
  const { cookie } = await auth.issueSession(guestUser.id, {
    data: { isGuest: true },
    ttl: 60 * 60 * 24 * 365, // 1 year
  })

  // 6. Set the session cookie
  event.response.headers.set('Set-Cookie', cookie)

  return { profileId: newProfile.id }
}, promoteDraftToGuestId)
// #endregion
