CREATE TABLE `community_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('empleo','trueque') NOT NULL,
	`mode` enum('trueque','donacion'),
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`location` varchar(255) NOT NULL,
	`contactName` varchar(160) NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`imageUrls` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_posts_id` PRIMARY KEY(`id`)
);
