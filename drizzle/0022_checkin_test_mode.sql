DROP INDEX "event_checkins_event_member_idx";--> statement-breakpoint
ALTER TABLE "event_checkins" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "event_checkins_event_member_test_idx" ON "event_checkins" USING btree ("event_id","member_id","is_test");