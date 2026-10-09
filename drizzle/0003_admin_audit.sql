CREATE TABLE "admin_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_member_idx" ON "admin_audit" USING btree ("member_id","created_at");