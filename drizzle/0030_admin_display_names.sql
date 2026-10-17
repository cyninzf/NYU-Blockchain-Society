CREATE TABLE "admin_profiles" (
	"email" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
