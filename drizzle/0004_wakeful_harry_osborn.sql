CREATE TABLE `profile_phase_settings` (
	`profile_id` text NOT NULL,
	`phase_range` text NOT NULL,
	`income` integer DEFAULT 75 NOT NULL,
	`timing` text DEFAULT 'end' NOT NULL,
	PRIMARY KEY(`profile_id`, `phase_range`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profile_settings` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`pulls_on_hand` integer DEFAULT 0 NOT NULL,
	`pity_agent_s` integer DEFAULT 0 NOT NULL,
	`guaranteed_agent_s` integer DEFAULT false NOT NULL,
	`pity_engine_s` integer DEFAULT 0 NOT NULL,
	`guaranteed_engine_s` integer DEFAULT false NOT NULL,
	`pity_agent_a` integer DEFAULT 0 NOT NULL,
	`guaranteed_agent_a` integer DEFAULT false NOT NULL,
	`pity_engine_a` integer DEFAULT 0 NOT NULL,
	`guaranteed_engine_a` integer DEFAULT false NOT NULL,
	`scenario` text DEFAULT 'p60' NOT NULL,
	`planning_mode` text DEFAULT 's-rank' NOT NULL,
	`luck_mode` text DEFAULT 'realistic' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_banners` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`channel_type` text NOT NULL,
	`start_utc` integer NOT NULL,
	`end_utc` integer NOT NULL,
	`version` text NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_banners`("id", "title", "channel_type", "start_utc", "end_utc", "version", "created_at", "updated_at") SELECT "id", "title", "channel_type", "start_utc", "end_utc", "version", "created_at", "updated_at" FROM `banners`;--> statement-breakpoint
DROP TABLE `banners`;--> statement-breakpoint
ALTER TABLE `__new_banners` RENAME TO `banners`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_profiles`("id", "user_id", "name", "created_at", "updated_at") SELECT "id", "user_id", "name", "created_at", "updated_at" FROM `profiles`;--> statement-breakpoint
DROP TABLE `profiles`;--> statement-breakpoint
ALTER TABLE `__new_profiles` RENAME TO `profiles`;--> statement-breakpoint
ALTER TABLE `profile_targets` DROP COLUMN `count`;