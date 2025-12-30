import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// #region auth
export const users = sqliteTable('users', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text(),
  email: text().unique(),
  emailVerified: integer({ mode: 'boolean' }),
  image: text(),
  createdAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
  isGuest: integer({ mode: 'boolean' }).default(false),
  lastActiveAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const accounts = sqliteTable('accounts', {
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text().notNull(),
  provider: text().notNull(),
  providerAccountId: text().notNull(),
  refreshToken: text(),
  accessToken: text(),
  expiresAt: integer(),
  tokenType: text(),
  scope: text(),
  idToken: text(),
  sessionState: text(),
  createdAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
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
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(), // e.g., "Main Account", "Alt Account"
  createdAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert

export const profileTargets = sqliteTable('profile_targets', {
  id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
  profileId: text()
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  targetId: text().notNull(), // character slug
  channelType: text({ enum: ['agent', 'engine'] }).notNull(),
  order: integer().notNull().default(0),
})

export type ProfileTarget = typeof profileTargets.$inferSelect
export type NewProfileTarget = typeof profileTargets.$inferInsert

export const profileSettings = sqliteTable('profile_settings', {
  profileId: text()
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),

  // Global inputs
  pullsOnHand: integer().notNull().default(0),

  // S-Rank pity state
  pityAgentS: integer().notNull().default(0),
  guaranteedAgentS: integer({ mode: 'boolean' }).notNull().default(false),
  pityEngineS: integer().notNull().default(0),
  guaranteedEngineS: integer({ mode: 'boolean' }).notNull().default(false),

  // A-Rank pity state
  pityAgentA: integer().notNull().default(0),
  guaranteedAgentA: integer({ mode: 'boolean' }).notNull().default(false),
  pityEngineA: integer().notNull().default(0),
  guaranteedEngineA: integer({ mode: 'boolean' }).notNull().default(false),

  // Planner preferences
  scenario: text({ enum: ['p50', 'p60', 'p75', 'p90', 'ev'] }).notNull().default('p60'),
  planningMode: text({ enum: ['s-rank', 'a-rank'] }).notNull().default('s-rank'),
  luckMode: text({ enum: ['best', 'realistic', 'worst'] }).notNull().default('realistic'),

  createdAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export type ProfileSettingsRow = typeof profileSettings.$inferSelect
export type NewProfileSettingsRow = typeof profileSettings.$inferInsert

// Phase-specific settings (keyed by date range)
export const profilePhaseSettings = sqliteTable('profile_phase_settings', {
  profileId: text()
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  phaseRange: text().notNull(), // e.g., "2025-01-01→2025-01-15"

  income: integer().notNull().default(75),
  timing: text({ enum: ['start', 'end'] }).notNull().default('end'),
}, table => [
  primaryKey({ columns: [table.profileId, table.phaseRange] }),
])

export type ProfilePhaseSettingsRow = typeof profilePhaseSettings.$inferSelect
export type NewProfilePhaseSettingsRow = typeof profilePhaseSettings.$inferInsert
// #endregion user

// #region game data
export const banners = sqliteTable('banners', {
  id: text().primaryKey(), // slug (e.g., "alone-in-a-shared-dream-2025-11-05")
  title: text().notNull(),
  channelType: text({ enum: ['agent', 'engine'] }).notNull(),
  startUtc: integer().notNull(), // epoch seconds
  endUtc: integer().notNull(),
  version: text().notNull(),
  createdAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export type Banner = typeof banners.$inferSelect
export type NewBanner = typeof banners.$inferInsert

export const targets = sqliteTable('targets', {
  id: text().primaryKey(), // normalized name (e.g., "yidhari")
  displayName: text().notNull(),
  nickname: text(),
  rarity: integer().notNull(), // 5 = S, 4 = A
  type: text({ enum: ['agent', 'engine'] }).notNull(),
  attribute: text(),
  specialty: text(),
  iconPath: text(),
  updatedAt: integer({ mode: 'timestamp' }).notNull(),
})

export type Target = typeof targets.$inferSelect
export type NewTarget = typeof targets.$inferInsert

export const bannerTargets = sqliteTable('banner_targets', {
  bannerId: text().references(() => banners.id, { onDelete: 'cascade' }).notNull(),
  targetId: text().references(() => targets.id, { onDelete: 'cascade' }).notNull(),
  order: integer().notNull(),
  isFeatured: integer({ mode: 'boolean' }).default(false).notNull(),
  alias: text(),
}, table => [
  primaryKey({
    columns: [table.bannerId, table.targetId],
  }),
])

export type BannerTarget = typeof bannerTargets.$inferSelect
export type NewBannerTarget = typeof bannerTargets.$inferInsert

export const scrapeRuns = sqliteTable('scrape_runs', {
  id: integer().primaryKey({ autoIncrement: true }),
  startedAt: integer({ mode: 'timestamp' }).notNull(),
  finishedAt: integer({ mode: 'timestamp' }),
  status: text({ enum: ['running', 'success', 'failed', 'skipped'] }).notNull(),
  message: text(),
  diffJson: text(),
})

export type ScrapeRun = typeof scrapeRuns.$inferSelect
export type NewScrapeRun = typeof scrapeRuns.$inferInsert

export const attributes = sqliteTable('attributes', {
  id: text().primaryKey(), // Name (e.g. "Physical")
  iconPath: text(),
  updatedAt: integer({ mode: 'timestamp' }).notNull(),
})

export type Attribute = typeof attributes.$inferSelect
export type NewAttribute = typeof attributes.$inferInsert

export const specialties = sqliteTable('specialties', {
  id: text().primaryKey(), // Name (e.g. "Attack")
  iconPath: text(),
  updatedAt: integer({ mode: 'timestamp' }).notNull(),
})

export type Specialty = typeof specialties.$inferSelect
export type NewSpecialty = typeof specialties.$inferInsert
