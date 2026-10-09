CREATE TABLE "email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"recipients" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "email_log" USING btree ("created_at");