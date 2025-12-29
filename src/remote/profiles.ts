import type { PhaseSettings, Profile, ProfileSettings } from '~/types/profile'
import { action, query } from '@solidjs/router'
import { eq } from 'drizzle-orm'
import { getRequestEvent } from 'solid-js/web'
import { z } from 'zod'
import { profilePhaseSettings, profiles, profileSettings, profileTargets, users } from '~/db/schema'
import { optionalUser, requireDb, requireUser } from '~/remote/utils/server'
import { defaultSettings } from '~/types/profile'
import { idSchema, parse } from '~/utils'

// #region Schemas
const channelTypeSchema = z.enum(['agent', 'engine'])
const profileTargetSchema = z.object({
  id: idSchema.optional(),
  targetId: idSchema,
  channelType: channelTypeSchema,
  order: z.number().int().min(0).optional(),
})

const scenarioSchema = z.enum(['p50', 'p60', 'p75', 'p90', 'ev'])
const planningModeSchema = z.enum(['s-rank', 'a-rank'])
const luckModeSchema = z.enum(['best', 'realistic', 'worst'])

const profileSettingsSchema = z.object({
  pullsOnHand: z.number().int().min(0),
  pityAgentS: z.number().int().min(0).max(89),
  guaranteedAgentS: z.boolean(),
  pityEngineS: z.number().int().min(0).max(79),
  guaranteedEngineS: z.boolean(),
  pityAgentA: z.number().int().min(0).max(9),
  guaranteedAgentA: z.boolean(),
  pityEngineA: z.number().int().min(0).max(9),
  guaranteedEngineA: z.boolean(),
  scenario: scenarioSchema,
  planningMode: planningModeSchema,
  luckMode: luckModeSchema,
})

const phaseSettingsSchema = z.object({
  income: z.number().int().min(0),
  timing: z.enum(['start', 'end']),
})

const draftDataSchema = z.object({
  name: z.string().min(1).optional(),
  targets: z.array(profileTargetSchema),
  settings: profileSettingsSchema.optional(),
  phaseSettings: z.record(z.string(), phaseSettingsSchema).optional(),
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

// #region Helpers
function dbSettingsToProfile(row: typeof profileSettings.$inferSelect | null): ProfileSettings {
  if (!row)
    return defaultSettings()
  return {
    pullsOnHand: row.pullsOnHand,
    pityAgentS: row.pityAgentS,
    guaranteedAgentS: row.guaranteedAgentS,
    pityEngineS: row.pityEngineS,
    guaranteedEngineS: row.guaranteedEngineS,
    pityAgentA: row.pityAgentA,
    guaranteedAgentA: row.guaranteedAgentA,
    pityEngineA: row.pityEngineA,
    guaranteedEngineA: row.guaranteedEngineA,
    scenario: row.scenario as ProfileSettings['scenario'],
    planningMode: row.planningMode as ProfileSettings['planningMode'],
    luckMode: row.luckMode as ProfileSettings['luckMode'],
  }
}

function dbPhaseSettingsToRecord(rows: (typeof profilePhaseSettings.$inferSelect)[]): Record<string, PhaseSettings> {
  const result: Record<string, PhaseSettings> = {}
  for (const row of rows) {
    result[row.phaseRange] = {
      income: row.income,
      timing: row.timing as PhaseSettings['timing'],
    }
  }
  return result
}

async function upsertProfileSettings(db: any, input: { profileId: string, settings: ProfileSettings }) {
  const existing = await db.query.profileSettings.findFirst({
    where: eq(profileSettings.profileId, input.profileId),
  })

  const values = {
    profileId: input.profileId,
    ...input.settings,
  }

  if (!existing) {
    await db.insert(profileSettings).values(values)
    return
  }

  await db.update(profileSettings)
    .set(input.settings)
    .where(eq(profileSettings.profileId, input.profileId))
}

async function upsertProfilePhaseSettings(db: any, input: { profileId: string, phaseSettings: Record<string, PhaseSettings> }) {
  // Delete existing phase settings for this profile
  await db.delete(profilePhaseSettings).where(eq(profilePhaseSettings.profileId, input.profileId))

  // Insert new ones
  const rows = Object.entries(input.phaseSettings).map(([phaseRange, ps]) => ({
    profileId: input.profileId,
    phaseRange,
    income: ps.income,
    timing: ps.timing,
  }))

  if (rows.length > 0)
    await db.insert(profilePhaseSettings).values(rows)
}
// #endregion

// #region GET Profiles
const getProfilesId = 'profiles:get'

/**
 * Get all profiles for the current user
 */
export const getProfiles = query(async (): Promise<Profile[]> => {
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
      profilePhaseSettings: true,
    },
  })

  return userProfiles.map(p => ({
    id: p.id,
    name: p.name,
    targets: p.profileTargets.map((t: any) => ({
      id: t.id,
      targetId: t.targetId,
      channelType: t.channelType,
      order: t.order,
    })),
    settings: dbSettingsToProfile(p.profileSettings),
    phaseSettings: dbPhaseSettingsToRecord(p.profilePhaseSettings ?? []),
  }))
}, getProfilesId)
// #endregion

// #region GET Profile
const getProfileId = 'profile:get'

/**
 * Get a single profile by ID (must belong to current user)
 */
export const getProfile = query(async (raw: GetProfileInput): Promise<Profile | null> => {
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
      profilePhaseSettings: true,
    },
  })

  // Ensure profile belongs to user
  if (!profile || profile.userId !== user.id)
    return null

  return {
    id: profile.id,
    name: profile.name,
    targets: profile.profileTargets.map((t: any) => ({
      id: t.id,
      targetId: t.targetId,
      channelType: t.channelType,
      order: t.order,
    })),
    settings: dbSettingsToProfile(profile.profileSettings),
    phaseSettings: dbPhaseSettingsToRecord(profile.profilePhaseSettings ?? []),
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

  // Create default settings row
  await db.insert(profileSettings).values({
    profileId: newProfile.id,
    ...defaultSettings(),
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
        id: t.id ?? crypto.randomUUID(),
        profileId: input.profileId,
        targetId: t.targetId,
        channelType: t.channelType,
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

// #region SAVE Profile Phase Settings
const saveProfilePhaseSettingsId = 'profile-phase-settings:save'

const saveProfilePhaseSettingsSchema = z.object({
  profileId: idSchema,
  phaseSettings: z.record(z.string(), phaseSettingsSchema),
})
type SaveProfilePhaseSettingsInput = z.infer<typeof saveProfilePhaseSettingsSchema>

/**
 * Upsert phase settings for a profile
 */
export const saveProfilePhaseSettings = action(async (raw: SaveProfilePhaseSettingsInput): Promise<void> => {
  'use server'
  const user = await requireUser()
  const input = parse(saveProfilePhaseSettingsSchema, raw, saveProfilePhaseSettingsId)
  const db = await requireDb()

  // Verify ownership
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, input.profileId),
  })
  if (!profile || profile.userId !== user.id)
    throw new Error('Profile not found')

  await upsertProfilePhaseSettings(db, { profileId: input.profileId, phaseSettings: input.phaseSettings })
}, saveProfilePhaseSettingsId)
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

  // 3.5 Create profile settings
  const settings = draftData.settings ?? defaultSettings()
  await db.insert(profileSettings).values({
    profileId: newProfile.id,
    ...settings,
  })

  // 3.6 Create phase settings if provided
  if (draftData.phaseSettings)
    await upsertProfilePhaseSettings(db, { profileId: newProfile.id, phaseSettings: draftData.phaseSettings })

  // 4. Insert draft targets
  if (draftData.targets.length > 0) {
    await db.insert(profileTargets).values(
      draftData.targets.map((t, i) => ({
        id: t.id ?? crypto.randomUUID(),
        profileId: newProfile.id,
        targetId: t.targetId,
        channelType: t.channelType,
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
