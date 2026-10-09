import { sql } from "drizzle-orm";
import { bigserial, boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// "friend" is no longer offered in the join flow but stays valid for existing rows.
export const AFFILIATIONS = ["alumni", "industry", "student", "faculty_staff", "friend"] as const;
export type Affiliation = (typeof AFFILIATIONS)[number];
export const affiliation = pgEnum("affiliation", AFFILIATIONS);

export const members = pgTable(
  "members",
  {
    /** Also the member's block number, in join order. */
    id: serial().primaryKey(),
    name: text().notNull(),
    email: text().notNull(),
    affiliation: affiliation().notNull(),
    /** Industry ids: blockchain, finance, ai. */
    blocks: text().array().notNull().default(sql`'{}'::text[]`),
    /** Programs to hear about: networking, accelerator, conference (older rows may hold "mentorship"). */
    notify: text().array().notNull().default(sql`'{}'::text[]`),
    /** Where they joined from, e.g. ?src=mixer on an event QR code. */
    source: text(),
    linkedinUrl: text("linkedin_url"),
    role: text(),
    company: text(),
    school: text(),
    gradYear: integer("grad_year"),
    showOnWall: boolean("show_on_wall").notNull().default(false),
    wallName: text("wall_name"),
    wallApproved: boolean("wall_approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("members_email_lower_idx").on(sql`lower(${t.email})`)],
);

export type Member = typeof members.$inferSelect;

/** One row per rate-limited request. `key` is "<action>:<hmac of IP>": raw IPs are never stored. */
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    key: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_limit_hits_key_created_idx").on(t.key, t.createdAt)],
);

/**
 * People we know from outside the join flow, e.g. 2024 conference registrants imported from a
 * CSV. Contacts are NOT members: no block number, never counted as members, never on the wall.
 * `memberId` is set when the same email later joins through the normal flow.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: serial().primaryKey(),
    name: text(),
    email: text().notNull(),
    /** Import label, e.g. "conference-2024". */
    source: text().notNull(),
    /** Null when the import had no check-in column. */
    checkedIn: boolean("checked_in"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("contacts_email_lower_idx").on(sql`lower(${t.email})`), index("contacts_source_idx").on(t.source)],
);

export type Contact = typeof contacts.$inferSelect;

/** Field changes as { field: [old, new] }, e.g. { email: ["a@example.com", "b@example.com"] }. */
export type AuditChanges = Partial<Record<"name" | "email" | "affiliation" | "contact", [string | null, string | null]>>;

/**
 * Admin edits to members, so changes are traceable: who (the basic-auth user), when, and old →
 * new values. Rows go with the member when a member is deleted (removal requests).
 */
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: serial().primaryKey(),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    actor: text().notNull(),
    action: text().notNull(),
    changes: jsonb().$type<AuditChanges>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_audit_member_idx").on(t.memberId, t.createdAt)],
);

export type AdminAudit = typeof adminAudit.$inferSelect;
