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
    /** "City and country", free text as entered. */
    location: text(),
    /** Read from `location` on save (lib/location.ts) for the admin's per-country counts and filter. */
    country: text(),
    showOnWall: boolean("show_on_wall").notNull().default(false),
    wallName: text("wall_name"),
    wallApproved: boolean("wall_approved").notNull().default(false),
    /** Set by the unsubscribe link: no email of any kind goes to this member while it's set. */
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
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
export type AuditChanges = Record<string, [string | null, string | null]>;

/**
 * Every admin action: who (the admin's email; "basic:<user>" under the shared-password fallback),
 * when, what. Member edits carry old → new values in `changes`; other actions (deletes, imports,
 * exports, sends, team changes) describe themselves in `detail`. A member's rows go with the
 * member when it's deleted (they hold old emails); the delete itself is logged without a member.
 */
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: serial().primaryKey(),
    memberId: integer("member_id").references(() => members.id, { onDelete: "cascade" }),
    actor: text().notNull(),
    /** e.g. edit, member.delete, contacts.import, export.members, team.add, announcement.send */
    action: text().notNull(),
    changes: jsonb().$type<AuditChanges>().notNull().default({}),
    detail: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_audit_member_idx").on(t.memberId, t.createdAt), index("admin_audit_actor_idx").on(t.actor, t.createdAt)],
);

export type AdminAudit = typeof adminAudit.$inferSelect;

export const groupRole = pgEnum("linkedin_group_role", ["owner", "manager"]);

/**
 * The LinkedIn group roster, imported by an admin from the group's member export. Only name,
 * headline and group role are kept: no email, no "Open to work", nothing else. These are not
 * members; `memberId` is set only by an admin's manual "Link to member", never automatically.
 */
export const linkedinGroupMembers = pgTable(
  "linkedin_group_members",
  {
    id: serial().primaryKey(),
    name: text().notNull(),
    headline: text().notNull().default(""),
    /** Null for ordinary group members. */
    groupRole: groupRole("group_role"),
    /** Import label, e.g. "linkedin-group-2026-10". */
    source: text().notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("linkedin_group_members_name_headline_idx").on(sql`lower(${t.name})`, sql`lower(${t.headline})`),
    index("linkedin_group_members_member_idx").on(t.memberId),
  ],
);

export type LinkedinGroupMember = typeof linkedinGroupMembers.$inferSelect;

/**
 * Every email sent through Resend, as counts only (no addresses, no content): the daily quota
 * check for announcements counts all of them, since welcome emails and sign-in links use it too.
 */
export const emailLog = pgTable(
  "email_log",
  {
    id: serial().primaryKey(),
    /** welcome, admin-link, member-link, announcement, announcement-test */
    kind: text().notNull(),
    recipients: integer().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_log_created_idx").on(t.createdAt)],
);

export const ADMIN_ROLES = ["super_admin", "admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export const adminRole = pgEnum("admin_role", ADMIN_ROLES);

/**
 * Personal admin logins. SUPER_ADMIN_EMAIL (an environment variable) is always a super admin on
 * top of these rows and is never stored here. Removing sets `removed_at` (re-adding clears it).
 */
export const adminUsers = pgTable(
  "admin_users",
  {
    id: serial().primaryKey(),
    /** Stored lowercase. */
    email: text().notNull(),
    role: adminRole().notNull().default("admin"),
    addedBy: text("added_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("admin_users_email_idx").on(sql`lower(${t.email})`)],
);

export type AdminUser = typeof adminUsers.$inferSelect;

/**
 * Magic-link tokens (admin sign-in, member "Update your block"). Only a SHA-256 of the token is
 * stored; each works once (`used_at`) and expires after 15 minutes.
 */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: serial().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    /** admin | member */
    purpose: text().notNull(),
    /** admin: the lowercase email; member: the member id */
    subject: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("auth_tokens_hash_idx").on(t.tokenHash)],
);
