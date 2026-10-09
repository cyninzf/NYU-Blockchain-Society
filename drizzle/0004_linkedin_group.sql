CREATE TYPE "public"."linkedin_group_role" AS ENUM('owner', 'manager');--> statement-breakpoint
CREATE TABLE "linkedin_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"group_role" "linkedin_group_role",
	"source" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" integer
);
--> statement-breakpoint
ALTER TABLE "linkedin_group_members" ADD CONSTRAINT "linkedin_group_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "linkedin_group_members_name_headline_idx" ON "linkedin_group_members" USING btree (lower("name"),lower("headline"));--> statement-breakpoint
CREATE INDEX "linkedin_group_members_member_idx" ON "linkedin_group_members" USING btree ("member_id");