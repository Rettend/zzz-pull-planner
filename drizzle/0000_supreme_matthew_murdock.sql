CREATE TABLE `banner_targets` (
	`banner_id` text NOT NULL,
	`target_id` text NOT NULL,
	`order` integer NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`alias` text,
	PRIMARY KEY(`banner_id`, `target_id`),
	FOREIGN KEY (`banner_id`) REFERENCES `banners`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `targets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `banners` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`channel_type` text NOT NULL,
	`start_utc` integer NOT NULL,
	`end_utc` integer NOT NULL,
	`version` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scrape_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`message` text,
	`diff_json` text
);
--> statement-breakpoint
CREATE TABLE `targets` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`rarity` integer NOT NULL,
	`type` text NOT NULL,
	`attribute` text,
	`specialty` text,
	`icon_path` text,
	`icon_etag` text,
	`updated_at` integer NOT NULL
);
