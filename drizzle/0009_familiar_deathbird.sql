CREATE TABLE `replay_events` (
	`round_id` text NOT NULL,
	`message_id` integer NOT NULL,
	`at` integer NOT NULL,
	`seat` integer NOT NULL,
	`kind` text NOT NULL,
	`text` text,
	`emote_id` text,
	PRIMARY KEY(`round_id`, `message_id`),
	FOREIGN KEY (`round_id`) REFERENCES `replay_rounds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_replay_events_time` ON `replay_events` (`round_id`,`at`,`message_id`);