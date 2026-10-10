-- Round 9.2: the LinkedIn group roster becomes contacts without email (name, headline, source and
-- any manual member link; never the group role). Same dedupe key as the roster, so nothing is lost.
INSERT INTO "contacts" ("name", "email", "headline", "source", "imported_at", "member_id")
SELECT "name", NULL, NULLIF("headline", ''), "source", "imported_at", "member_id"
FROM "linkedin_group_members"
ORDER BY "id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
DROP TABLE "linkedin_group_members" CASCADE;--> statement-breakpoint
DROP TYPE "public"."linkedin_group_role";