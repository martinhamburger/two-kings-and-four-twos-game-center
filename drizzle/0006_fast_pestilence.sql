CREATE TABLE `user_avatars` (
	`user_id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`image` blob,
	`mime` text NOT NULL,
	`updated` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
