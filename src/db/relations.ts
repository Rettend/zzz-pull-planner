import { relations } from 'drizzle-orm'
import { accounts, banners, bannerTargets, profilePhaseSettings, profiles, profileSettings, profileTargets, targets, users } from './schema'

// #region auth
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  profiles: many(profiles),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  profileTargets: many(profileTargets),
  profileSettings: one(profileSettings, {
    fields: [profiles.id],
    references: [profileSettings.profileId],
  }),
  profilePhaseSettings: many(profilePhaseSettings),
}))

export const profileTargetsRelations = relations(profileTargets, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileTargets.profileId],
    references: [profiles.id],
  }),
}))

export const profileSettingsRelations = relations(profileSettings, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileSettings.profileId],
    references: [profiles.id],
  }),
}))

export const profilePhaseSettingsRelations = relations(profilePhaseSettings, ({ one }) => ({
  profile: one(profiles, {
    fields: [profilePhaseSettings.profileId],
    references: [profiles.id],
  }),
}))
// #endregion auth

// #region game data
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
// #endregion game data
