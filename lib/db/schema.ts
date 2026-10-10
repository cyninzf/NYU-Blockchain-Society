import { sql } from "drizzle-orm";
import { bigserial, boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
 * People we know from outside the join flow: imported lists such as 2024 conference registrants
 * (with email) or the LinkedIn group export (name and headline, no email). Contacts are NOT
 * members: no block number, never counted as members. A contact without an email can never be
 * emailed and is left out of every email feature (today no email goes to contacts at all).
 * `memberId` is set when the same person joins (lib/contact-links.ts).
 */
export const contacts = pgTable(
  "contacts",
  {
    id: serial().primaryKey(),
    name: text(),
    /** Null for lists without emails, e.g. the LinkedIn group export. */
    email: text(),
    /** From the LinkedIn export's "Title / Headline". */
    headline: text(),
    /** Import label, e.g. "luma-2024" or "linkedin-2026-10". */
    source: text().notNull(),
    /** Null when the import had no check-in column. */
    checkedIn: boolean("checked_in"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
    /** When this contact's invite link was used to join (round 12): the token works once. */
    inviteUsedAt: timestamp("invite_used_at", { withTimezone: true }),
    /** How `memberId` was set: email | name (automatic, lib/contact-links.ts) | invite (their invite link) | manual. Null when unlinked. */
    linkMethod: text("link_method"),
  },
  (t) => [
    // Dedupe: rows with an email on lower(email); rows without one on (name, headline).
    uniqueIndex("contacts_email_lower_idx").on(sql`lower(${t.email})`),
    uniqueIndex("contacts_name_headline_idx").on(sql`lower(${t.name})`, sql`lower(coalesce(${t.headline}, ''))`).where(sql`${t.email} is null`),
    index("contacts_source_idx").on(t.source),
  ],
);

export type Contact = typeof contacts.$inferSelect;

/**
 * Contact–member pairs an admin unlinked ("Undo"): automatic linking never pairs them again.
 * A manual "Link to member" still can.
 */
export const contactLinkBlocks = pgTable(
  "contact_link_blocks",
  {
    contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    actor: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.memberId] })],
);

/** Field changes as { field: [old, new] }, e.g. { email: ["a@example.com", "b@example.com"] }. */
export type AuditChanges = Record<string, [string | null, string | null]>;

/**
 * Every admin action: who (the admin's email; "system" for automatic contact links; rows from
 * before round 10 may read "basic:<user>", the removed shared-password fallback),
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

export type AnnouncementFilters = { blocks?: string[]; notify?: string[]; affiliation?: string; country?: string };

/**
 * Announcements from /admin: every test and every send, with who, the filters and the counts.
 * `contentHash` (subject + body) ties a send to an earlier test of the same text.
 */
export const announcements = pgTable(
  "announcements",
  {
    id: serial().primaryKey(),
    /** test | sent | partial | failed */
    status: text().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    contentHash: text("content_hash").notNull(),
    filters: jsonb().$type<AnnouncementFilters>().notNull().default({}),
    recipientCount: integer("recipient_count").notNull(),
    sentCount: integer("sent_count").notNull(),
    sentBy: text("sent_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("announcements_hash_idx").on(t.contentHash, t.createdAt)],
);

export type Announcement = typeof announcements.$inferSelect;

/**
 * Server-side sessions for admins and members. The cookie carries a random session id (signed);
 * only its SHA-256 is stored. Sign-out and admin removal set `revoked_at`, which ends the session
 * at once, even for a copied cookie.
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: serial().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    /** admin | member */
    kind: text().notNull(),
    /** admin: the lowercase email; member: the member id */
    subject: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("auth_sessions_hash_idx").on(t.tokenHash), index("auth_sessions_subject_idx").on(t.kind, t.subject)],
);

export const EVENT_STATUSES = ["draft", "published", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
export const eventStatus = pgEnum("event_status", EVENT_STATUSES);

/**
 * Events, managed at /admin/events (round 10). Times are stored in UTC and entered and shown in
 * America/New_York (lib/event-time.ts). Drafts are never public; cancelled events show as
 * cancelled until they end, then disappear. `slug` names the public page (/events/<slug>) and
 * the share link's ?src=event-<slug>.
 */
export const events = pgTable(
  "events",
  {
    id: serial().primaryKey(),
    title: text().notNull(),
    /** Small label above the title, e.g. "Networking evening"; "Event" when empty. */
    kind: text(),
    slug: text().notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    venueName: text("venue_name"),
    address: text(),
    /** Short, plain text. */
    description: text(),
    /** e.g. the Luma page. */
    registrationUrl: text("registration_url"),
    /** Free text, e.g. "KPMG": shown as "Co-hosted with …", never with a logo. */
    cohost: text(),
    status: eventStatus().notNull().default("draft"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("events_slug_idx").on(t.slug), index("events_starts_idx").on(t.startsAt)],
);

export type EventRow = typeof events.$inferSelect;

export const CHECKIN_METHODS = ["qr", "admin"] as const;
export const checkinMethod = pgEnum("checkin_method", CHECKIN_METHODS);

/**
 * Who came to an event (round 11). One row per member per event. "qr": the member checked in
 * themselves at /events/<slug>/checkin; "admin": a super admin checked them in by hand.
 */
export const eventCheckins = pgTable(
  "event_checkins",
  {
    id: serial().primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    method: checkinMethod().notNull(),
    /** Made in test mode (round 12.1): never counted, never on the live screen's real count. */
    isTest: boolean("is_test").notNull().default(false),
  },
  // One real and one test check-in per member per event: a test never blocks the real one.
  (t) => [uniqueIndex("event_checkins_event_member_test_idx").on(t.eventId, t.memberId, t.isTest), index("event_checkins_event_idx").on(t.eventId, t.checkedInAt)],
);

export const SUPPRESSION_REASONS = ["unsubscribe", "bounce", "complaint"] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

/**
 * Addresses that must never get an invite again (round 12): an unsubscribe from an invite, a
 * hard bounce or a spam complaint. Only a hash of the lowercased email is stored (lib/invites.ts),
 * so a re-imported contact is still recognised. Bounces and complaints also stop every other email.
 */
export const inviteSuppressions = pgTable(
  "invite_suppressions",
  {
    id: serial().primaryKey(),
    emailHash: text("email_hash").notNull(),
    reason: text().$type<SuppressionReason>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invite_suppressions_hash_idx").on(t.emailHash)],
);

/** Site settings edited by super admins at /admin/settings (round 12), e.g. "postal_address". */
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Invite campaigns (round 12): every test ("test") and every real send ("queued" → "done",
 * or "paused" by a super admin). `contentHash` ties a send to an earlier test of the same invite.
 */
export const inviteCampaigns = pgTable(
  "invite_campaigns",
  {
    id: serial().primaryKey(),
    /** test | queued | paused | done */
    status: text().notNull(),
    source: text().notNull(),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    subject: text().notNull(),
    body: text().notNull(),
    reason: text().notNull(),
    contentHash: text("content_hash").notNull(),
    total: integer().notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invite_campaigns_hash_idx").on(t.contentHash, t.createdAt)],
);

export type InviteCampaign = typeof inviteCampaigns.$inferSelect;

/**
 * One row per contact ever queued for an invite. Unique on contact_id: a contact can be in one
 * campaign only, so it's invited at most once, ever. queued → sending (claimed) → sent | failed,
 * or skipped when it stopped being eligible before its turn.
 */
export const inviteQueue = pgTable(
  "invite_queue",
  {
    id: serial().primaryKey(),
    campaignId: integer("campaign_id").notNull().references(() => inviteCampaigns.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    status: text().notNull().default("queued"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invite_queue_contact_idx").on(t.contactId), index("invite_queue_campaign_idx").on(t.campaignId, t.status)],
);

/**
 * Display links for an event's live screen (round 12.1): a signed URL a TV can open without
 * signing in. Only a SHA-256 of the token is stored. Valid only for that event's live screen,
 * only while check-in is open, and until revoked; it never sets a cookie or opens anything else.
 */
export const displayLinks = pgTable(
  "display_links",
  {
    id: serial().primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("display_links_hash_idx").on(t.tokenHash), index("display_links_event_idx").on(t.eventId)],
);

