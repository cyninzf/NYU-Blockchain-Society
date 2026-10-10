ALTER TABLE "contacts" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "headline" text;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_name_headline_idx" ON "contacts" USING btree (lower("name"),lower(coalesce("headline", ''))) WHERE "contacts"."email" is null;