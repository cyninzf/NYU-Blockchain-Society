CREATE TABLE "accelerator_interest" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"affiliation" text,
	"company" text,
	"one_liner" text,
	"stage" text,
	"focus" text[] DEFAULT '{}'::text[] NOT NULL,
	"website" text,
	"organization" text,
	"help" text[] DEFAULT '{}'::text[] NOT NULL,
	"message" text,
	"add_member" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "accelerator_interest_type_idx" ON "accelerator_interest" USING btree ("type","status","created_at");