CREATE TABLE "invite_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"event_id" integer,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"reason" text NOT NULL,
	"content_hash" text NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invite_campaigns" ADD CONSTRAINT "invite_campaigns_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_queue" ADD CONSTRAINT "invite_queue_campaign_id_invite_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."invite_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_queue" ADD CONSTRAINT "invite_queue_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invite_campaigns_hash_idx" ON "invite_campaigns" USING btree ("content_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invite_queue_contact_idx" ON "invite_queue" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "invite_queue_campaign_idx" ON "invite_queue" USING btree ("campaign_id","status");