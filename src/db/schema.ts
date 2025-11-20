import { relations, sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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

export const targets = sqliteTable('targets', {
  id: text('id').primaryKey(), // normalized name (e.g., "yidhari")
  displayName: text('display_name').notNull(),
  rarity: integer('rarity').notNull(), // 5 = S, 4 = A
  type: text('type', { enum: ['agent', 'engine'] }).notNull(),
  attribute: text('attribute'),
  specialty: text('specialty'),
  iconPath: text('icon_path'), // R2 key
  updatedAt: integer('updated_at').notNull(),
})

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

export const scrapeRuns = sqliteTable('scrape_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  status: text('status', { enum: ['success', 'failed', 'skipped'] }).notNull(),
  message: text('message'),
  diffJson: text('diff_json'),
})

export const bannersRelations = relations(banners, ({ many }) => ({
  bannerTargets: many(bannerTargets),
}))

export const targetsRelations = relations(targets, ({ many }) => ({
  bannerTargets: many(bannerTargets),
}))

export const bannerTargetsRelations = relations(bannerTargets, ({ one }) => ({
  banner: one(banners, {
    fields: [bannerTargets.bannerId],
    references: [banners.id],
  }),
  target: one(targets, {
    fields: [bannerTargets.targetId],
    references: [targets.id],
  }),
}))

export type Banner = typeof banners.$inferSelect
export type NewBanner = typeof banners.$inferInsert

export type Target = typeof targets.$inferSelect
export type NewTarget = typeof targets.$inferInsert

export type BannerTarget = typeof bannerTargets.$inferSelect
export type NewBannerTarget = typeof bannerTargets.$inferInsert

export type ScrapeRun = typeof scrapeRuns.$inferSelect
export type NewScrapeRun = typeof scrapeRuns.$inferInsert
