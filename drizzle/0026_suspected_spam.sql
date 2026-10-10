CREATE TABLE "pending_joins" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"affiliation" "affiliation" NOT NULL,
	"blocks" text[] DEFAULT '{}'::text[] NOT NULL,
	"notify" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text,
	"event_id" integer,
	"spam_reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accelerator_interest" ADD COLUMN "suspected_spam" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accelerator_interest" ADD COLUMN "spam_reason" text;--> statement-breakpoint
ALTER TABLE "conference_inquiries" ADD COLUMN "suspected_spam" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conference_inquiries" ADD COLUMN "spam_reason" text;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "suspected_spam" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "spam_reason" text;--> statement-breakpoint
ALTER TABLE "pending_joins" ADD CONSTRAINT "pending_joins_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;