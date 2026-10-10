CREATE TABLE "invite_suppressions" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_hash" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invite_suppressions_hash_idx" ON "invite_suppressions" USING btree ("email_hash");