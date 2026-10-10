CREATE TABLE "contact_link_blocks" (
	"contact_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_link_blocks_contact_id_member_id_pk" PRIMARY KEY("contact_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "link_method" text;--> statement-breakpoint
ALTER TABLE "contact_link_blocks" ADD CONSTRAINT "contact_link_blocks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_link_blocks" ADD CONSTRAINT "contact_link_blocks_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Links made before round 9.2: by email when the addresses match, otherwise by hand (the roster).
UPDATE "contacts" SET "link_method" = CASE
  WHEN EXISTS (SELECT 1 FROM "members" m WHERE m."id" = "contacts"."member_id" AND lower(m."email") = lower("contacts"."email")) THEN 'email'
  ELSE 'manual' END
WHERE "member_id" IS NOT NULL;
