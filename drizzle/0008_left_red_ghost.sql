CREATE TABLE `replay_frames` (
	`round_id` text NOT NULL,
	`seq` integer NOT NULL,
	`frame` text NOT NULL,
	PRIMARY KEY(`round_id`, `seq`),
	FOREIGN KEY (`round_id`) REFERENCES `replay_rounds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `replay_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`game` text NOT NULL,
	`participants` text NOT NULL,
	`practice` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`ended` integer
);
--> statement-breakpoint
CREATE INDEX `idx_replay_rounds_room_created` ON `replay_rounds` (`room_code`,`created`);--> statement-breakpoint
CREATE TABLE `replay_tv` (
	`replay_id` text PRIMARY KEY NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`withdrawn_at` integer,
	FOREIGN KEY (`replay_id`) REFERENCES `replay_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_replay_tv_submitted` ON `replay_tv` (`withdrawn_at`,`submitted_at`);