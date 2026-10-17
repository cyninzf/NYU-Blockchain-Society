ALTER TABLE "accelerator_interest" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "accelerator_interest" ADD COLUMN "school" text;--> statement-breakpoint
ALTER TABLE "accelerator_interest" ADD COLUMN "grad_year" integer;--> statement-breakpoint
ALTER TABLE "accelerator_interest" ADD COLUMN "needs" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "accelerator_interest" ADD COLUMN "contact_id" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "contact_type" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "focus" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "stage" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "nyu_alum" boolean;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "relationship" text DEFAULT 'cold' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_touch_at" date;--> statement-breakpoint
ALTER TABLE "accelerator_interest" ADD CONSTRAINT "accelerator_interest_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_linkedin_idx" ON "contacts" USING btree ("linkedin_url");