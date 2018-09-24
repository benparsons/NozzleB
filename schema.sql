CREATE TABLE IF NOT EXISTS "events" (
	`event_id`	text UNIQUE,
	`content_body`	TEXT,
	`content_msgtype`	TEXT,
	`origin_server_ts`	INTEGER,
	`room_id`	TEXT,
	`sender`	TEXT,
	`type`	TEXT,
	`redacts`	TEXT,
	PRIMARY KEY(`event_id`)
);
