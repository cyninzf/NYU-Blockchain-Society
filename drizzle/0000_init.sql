CREATE TYPE "public"."affiliation" AS ENUM('alumni', 'student', 'faculty_staff', 'friend');--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"affiliation" "affiliation" NOT NULL,
	"blocks" text[] DEFAULT '{}'::text[] NOT NULL,
	"notify" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text,
	"linkedin_url" text,
	"role" text,
	"company" text,
	"school" text,
	"grad_year" integer,
	"show_on_wall" boolean DEFAULT false NOT NULL,
	"wall_name" text,
	"wall_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "members_email_lower_idx" ON "members" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "rate_limit_hits_key_created_idx" ON "rate_limit_hits" USING btree ("key","created_at");