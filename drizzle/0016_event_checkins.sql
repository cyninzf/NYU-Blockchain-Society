CREATE TYPE "public"."checkin_method" AS ENUM('qr', 'admin');--> statement-breakpoint
CREATE TABLE "event_checkins" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" "checkin_method" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_checkins_event_member_idx" ON "event_checkins" USING btree ("event_id","member_id");--> statement-breakpoint
CREATE INDEX "event_checkins_event_idx" ON "event_checkins" USING btree ("event_id","checked_in_at");