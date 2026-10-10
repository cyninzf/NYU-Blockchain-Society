CREATE TABLE "conference_inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"interest" text NOT NULL,
	"message" text NOT NULL,
	"edition" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "conference_inquiries_status_idx" ON "conference_inquiries" USING btree ("status","created_at");