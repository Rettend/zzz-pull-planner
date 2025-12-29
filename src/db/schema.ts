import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// #region auth
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const accounts = sqliteTable('accounts', {
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, account => [
  primaryKey({
    columns: [account.provider, account.providerAccountId],
  }),
])

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
// #endregion auth

// #region user
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // e.g., "Main Account", "Alt Account"
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull().$onUpdateFn(() => sql`(unixepoch())`),
})

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert

export const profileTargets = sqliteTable('profile_targets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  profileId: text('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  targetId: text('target_id').notNull(), // character slug
  channelType: text('channel_type', { enum: ['agent', 'engine'] }).notNull(),
  count: integer('count').notNull().default(0), // mindscapes
  order: integer('order').notNull().default(0),
})

export type ProfileTarget = typeof profileTargets.$inferSelect
export type NewProfileTarget = typeof profileTargets.$inferInsert

export const profileSettings = sqliteTable('profile_settings', {
  profileId: text('profile_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),

  // Profile-scoped planner state (SSR + cross-device)
  plannerInputsJson: text('planner_inputs_json').notNull().default('{}'),
  scenario: text('scenario').notNull().default('p60'),
  phaseTimingsJson: text('phase_timings_json').notNull().default('{}'),
  planningMode: text('planning_mode', { enum: ['s-rank', 'a-rank'] }).notNull().default('s-rank'),

  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull().$onUpdateFn(() => sql`(unixepoch())`),
})

export type ProfileSettings = typeof profileSettings.$inferSelect
export type NewProfileSettings = typeof profileSettings.$inferInsert
// #endregion user

// #region game data
export const banners = sqliteTable('banners', {
  id: text('id').primaryKey(), // slug (e.g., "alone-in-a-shared-dream-2025-11-05")
  title: text('title').notNull(),
  channelType: text('channel_type', { enum: ['agent', 'engine'] }).notNull(),
  startUtc: integer('start_utc').notNull(), // epoch seconds
  endUtc: integer('end_utc').notNull(),
  version: text('version').notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull().$onUpdateFn(() => sql`(unixepoch())`),
})

export type Banner = typeof banners.$inferSelect
export type NewBanner = typeof banners.$inferInsert

export const targets = sqliteTable('targets', {
  id: text('id').primaryKey(), // normalized name (e.g., "yidhari")
  displayName: text('display_name').notNull(),
  nickname: text('nickname'),
  rarity: integer('rarity').notNull(), // 5 = S, 4 = A
  type: text('type', { enum: ['agent', 'engine'] }).notNull(),
  attribute: text('attribute'),
  specialty: text('specialty'),
  iconPath: text('icon_path'),
  updatedAt: integer('updated_at').notNull(),
})

export type Target = typeof targets.$inferSelect
export type NewTarget = typeof targets.$inferInsert

export const bannerTargets = sqliteTable('banner_targets', {
  bannerId: text('banner_id').references(() => banners.id, { onDelete: 'cascade' }).notNull(),
  targetId: text('target_id').references(() => targets.id, { onDelete: 'cascade' }).notNull(),
  order: integer('order').notNull(),
  isFeatured: integer('is_featured', { mode: 'boolean' }).default(false).notNull(),
  alias: text('alias'),
}, table => [
  primaryKey({
    columns: [table.bannerId, table.targetId],
  }),
])

export type BannerTarget = typeof bannerTargets.$inferSelect
export type NewBannerTarget = typeof bannerTargets.$inferInsert

export const scrapeRuns = sqliteTable('scrape_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  status: text('status', { enum: ['success', 'failed', 'skipped'] }).notNull(),
  message: text('message'),
  diffJson: text('diff_json'),
})

export type ScrapeRun = typeof scrapeRuns.$inferSelect
export type NewScrapeRun = typeof scrapeRuns.$inferInsert

export const attributes = sqliteTable('attributes', {
  id: text('id').primaryKey(), // Name (e.g. "Physical")
  iconPath: text('icon_path'),
  updatedAt: integer('updated_at').notNull(),
})

export type Attribute = typeof attributes.$inferSelect
export type NewAttribute = typeof attributes.$inferInsert

export const specialties = sqliteTable('specialties', {
  id: text('id').primaryKey(), // Name (e.g. "Attack")
  iconPath: text('icon_path'),
  updatedAt: integer('updated_at').notNull(),
})

export type Specialty = typeof specialties.$inferSelect
export type NewSpecialty = typeof specialties.$inferInsert
