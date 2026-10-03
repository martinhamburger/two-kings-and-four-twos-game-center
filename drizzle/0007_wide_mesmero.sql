CREATE TABLE `player_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`day` text NOT NULL,
	`slot` integer NOT NULL,
	`content` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "feedback_slot" CHECK("player_feedback"."slot" BETWEEN 1 AND 5),
	CONSTRAINT "feedback_length" CHECK(length("player_feedback"."content") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_feedback_daily_slot` ON `player_feedback` (`user_id`,`day`,`slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_feedback_retry` ON `player_feedback` (`user_id`,`client_id`);