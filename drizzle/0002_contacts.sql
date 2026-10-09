CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"source" text NOT NULL,
	"checked_in" boolean,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invited_at" timestamp with time zone,
	"member_id" integer
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_email_lower_idx" ON "contacts" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "contacts_source_idx" ON "contacts" USING btree ("source");