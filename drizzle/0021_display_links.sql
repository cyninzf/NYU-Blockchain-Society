CREATE TABLE "display_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "display_links" ADD CONSTRAINT "display_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "display_links_hash_idx" ON "display_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "display_links_event_idx" ON "display_links" USING btree ("event_id");