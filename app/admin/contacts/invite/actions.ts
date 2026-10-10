"use server";

import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { after } from "next/server";
import { auditRow, requireSuperOr403 } from "@/lib/admin";
import { isProduction } from "@/lib/base-url";
import type { Db } from "@/lib/db";
import { adminAudit, contacts, events, inviteCampaigns } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { InviteDraft, inviteEmail, inviteHash, type FeaturedEvent } from "@/lib/invite-email";
import { processInvites } from "@/lib/invite-queue";
import { queueableWhere } from "@/lib/invites";
import { postalAddress } from "@/lib/settings";

// Invites to contacts: super admins only, every action refused (403, logged) for anyone else.
// A real send needs a postal address, production, a test of exactly the same invite in the last
// 24 hours, and the eligible count the admin confirmed.

export type InviteInput = { subject: string; body: string; reason: string; source: string; eventId: number | null };
export type InviteResult = { ok: true; message: string } | { ok: false; error: string };

const SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const NO_ADDRESS = "Set the society's postal address in Settings first: every invite must carry it.";

type Parsed = { ok: true; draft: InviteDraft; source: string; eventId: number | null } | { ok: false; error: string };

function parse(d: InviteInput): Parsed {
  const draft = InviteDraft.safeParse(d);
  if (!draft.success) return { ok: false, error: draft.error.issues[0]?.message ?? "Check the invite." };
  if (!SOURCE_RE.test(d.source)) return { ok: false, error: "Pick a source." };
  const eventId = d.eventId && Number.isInteger(d.eventId) && d.eventId > 0 ? d.eventId : null;
  return { ok: true, draft: draft.data, source: d.source, eventId };
}

/** Only a published, upcoming event can be featured. */
async function eventFor(db: Db, id: number | null): Promise<FeaturedEvent | null | "invalid"> {
  if (!id) return null;
  const [e] = await db.select({ title: events.title, startsAt: events.startsAt, endsAt: events.endsAt, venueName: events.venueName }).from(events)
    .where(and(eq(events.id, id), eq(events.status, "published"), gt(sql`coalesce(${events.endsAt}, ${events.startsAt})`, sql`now()`)));
  return e ?? "invalid";
}

const eligibleCount = async (db: Db, source: string) =>
  (await db.select({ n: count() }).from(contacts).where(and(eq(contacts.source, source), queueableWhere())))[0].n;

/** Live preview: the email as the first contact would get it (with a sample name). */
export async function previewInvite(d: InviteInput): Promise<{ html: string } | { error: string }> {
  const { db } = await requireSuperOr403("preview an invite");
  const p = parse(d);
  if (!p.ok) return { error: p.error };
  const event = await eventFor(db, p.eventId);
  const m = inviteEmail(p.draft, { to: "preview", source: p.source, contact: { id: 0, name: "Alex Example" }, event: event === "invalid" ? null : event, postalAddress: (await postalAddress(db)) ?? "(postal address, set in Settings)" });
  return { html: m.html };
}

export async function countEligible(source: string): Promise<number> {
  const { db } = await requireSuperOr403("count invite recipients");
  return SOURCE_RE.test(source) ? eligibleCount(db, source) : 0;
}

/** The required test: the exact invite to the signed-in admin's own address. */
export async function sendInviteTest(d: InviteInput): Promise<InviteResult> {
  const { db, admin, actor } = await requireSuperOr403("send an invite test");
  const p = parse(d);
  if (!p.ok) return { ok: false, error: p.error };
  const address = await postalAddress(db);
  if (!address) return { ok: false, error: NO_ADDRESS };
  const event = await eventFor(db, p.eventId);
  if (event === "invalid") return { ok: false, error: "That event isn't published and upcoming any more. Pick another or none." };
  const r = await sendEmail(db, "invite-test", inviteEmail(p.draft, { to: admin.email, source: p.source, contact: null, event, postalAddress: address }));
  if (!r.ok) return { ok: false, error: r.error };
  await db.batch([
    db.insert(inviteCampaigns).values({ status: "test", source: p.source, eventId: p.eventId, ...p.draft, contentHash: inviteHash(p.draft, p.eventId), createdBy: actor }),
    db.insert(adminAudit).values(auditRow(actor, "invite.test", `Test of invite "${p.draft.subject}" (source ${p.source}) sent to ${admin.email}`)),
  ]);
  refresh();
  return { ok: true, message: `Test sent to ${admin.email}. Check it, then send.` };
}

/** Queues the campaign and sends today's share at once; the daily cron sends the rest. */
export async function startInviteCampaign(d: InviteInput, expected: number): Promise<InviteResult> {
  const { db, actor } = await requireSuperOr403("send invites");
  if (!isProduction()) return { ok: false, error: "Invites only go out from the production site (previews hold copies of real contacts). Test sends work here." };
  const p = parse(d);
  if (!p.ok) return { ok: false, error: p.error };
  if (!(await postalAddress(db))) return { ok: false, error: NO_ADDRESS };
  if ((await eventFor(db, p.eventId)) === "invalid") return { ok: false, error: "That event isn't published and upcoming any more. Pick another or none." };
  const hash = inviteHash(p.draft, p.eventId);
  const [test] = await db.select({ id: inviteCampaigns.id }).from(inviteCampaigns)
    .where(and(eq(inviteCampaigns.contentHash, hash), eq(inviteCampaigns.status, "test"), gt(inviteCampaigns.createdAt, sql`now() - interval '24 hours'`)));
  if (!test) return { ok: false, error: "Send yourself a test of this exact invite first (any edit, or another event, needs a new test)." };
  const n = await eligibleCount(db, p.source);
  if (!n) return { ok: false, error: "No eligible contacts in that source." };
  if (n !== expected) return { ok: false, error: `The eligible count changed to ${n}. Check it and send again.` };

  const [c] = await db.insert(inviteCampaigns).values({ status: "queued", source: p.source, eventId: p.eventId, ...p.draft, contentHash: hash, createdBy: actor }).returning({ id: inviteCampaigns.id });
  // Unique on contact: anyone already queued elsewhere (a concurrent campaign) is left out.
  const queued = await db.execute(sql`
    insert into invite_queue (campaign_id, contact_id)
    select ${c.id}, ${contacts.id} from ${contacts} where ${contacts.source} = ${p.source} and ${queueableWhere()}
    on conflict (contact_id) do nothing returning id`);
  const total = queued.rows.length;
  await db.batch([
    db.update(inviteCampaigns).set({ total, ...(total ? {} : { status: "done" }) }).where(eq(inviteCampaigns.id, c.id)),
    db.insert(adminAudit).values(auditRow(actor, "invite.campaign", `Campaign #${c.id} "${p.draft.subject}": ${total} contacts from ${p.source} queued${p.eventId ? ` (featuring event #${p.eventId})` : ""}`)),
  ]);
  after(() => processInvites(db).catch((e) => console.error("invite run failed", e instanceof Error ? e.message : e)));
  refresh();
  return { ok: true, message: `Campaign #${c.id}: ${total} invites queued. Today's share goes out now; the daily run sends the rest.` };
}

/** Pause or resume a campaign's queue. Already-sent invites are unaffected. */
export async function setCampaignPaused(fd: FormData) {
  const id = Number(fd.get("id")), pause = fd.get("pause") === "1";
  const { db, actor } = await requireSuperOr403(`${pause ? "pause" : "resume"} invite campaign #${id}`);
  if (!Number.isInteger(id) || id < 1) throw new Error("Bad request");
  const [c] = await db.update(inviteCampaigns).set({ status: pause ? "paused" : "queued", updatedAt: new Date() })
    .where(and(eq(inviteCampaigns.id, id), inArray(inviteCampaigns.status, pause ? ["queued"] : ["paused"]))).returning({ id: inviteCampaigns.id });
  if (c) await db.insert(adminAudit).values(auditRow(actor, pause ? "invite.pause" : "invite.resume", `${pause ? "Paused" : "Resumed"} campaign #${id}`));
  if (c && !pause) after(() => processInvites(db).catch((e) => console.error("invite run failed", e instanceof Error ? e.message : e)));
  refresh();
}

