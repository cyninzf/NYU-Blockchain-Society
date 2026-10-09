CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"content_hash" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recipient_count" integer NOT NULL,
	"sent_count" integer NOT NULL,
	"sent_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "announcements_hash_idx" ON "announcements" USING btree ("content_hash","created_at");