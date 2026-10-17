/* eslint-disable @typescript-eslint/no-explicit-any -- the PGlite database stands in for the app's Neon-typed Db */
// npm run test:db — applies every migration in drizzle/ to an in-memory Postgres (PGlite) and
// exercises the app's real database code with obviously fake data (example.com). No network,
// no DATABASE_URL, nothing written anywhere. Run it before every commit that touches the database.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq, sql } from "drizzle-orm";
const P = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
// Throwaway secrets for token sealing and signing; never real ones.
process.env.AUTH_SECRET ||= "test-only-auth-secret-not-for-production";
process.env.FORM_SECRET ||= "test-only-form-secret";
const schema = await import(`${P}/lib/db/schema.ts`);
const pg = new PGlite();
const journal = JSON.parse(readFileSync(`${P}/drizzle/meta/_journal.json`, "utf8"));
for (const e of journal.entries) {
  for (const stmt of readFileSync(`${P}/drizzle/${e.tag}.sql`, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await pg.exec(stmt);
}
console.log("migrations applied:", journal.entries.length);
const db: any = drizzle(pg, { schema });
db.batch = async (qs: any[]) => { const out = []; for (const q of qs) out.push(await q); return out; };
let failed = 0;
const ok = (cond: unknown, msg: string) => { if (!cond) { failed++; console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg); };

const { members, contacts, settings, events, inviteCampaigns, eventCheckins, adminAudit } = schema;
await db.insert(members).values([
  { name: "Ana Member", email: "ana@example.com", affiliation: "alumni" },
  { name: "José García", email: "jose@example.com", affiliation: "industry" },
  { name: "Sam Twin", email: "sam1@example.com", affiliation: "alumni" },
  { name: "Sam Twin", email: "sam2@example.com", affiliation: "alumni" },
]);
await db.insert(contacts).values([
  { name: "Ana Member", email: "ANA@example.com", source: "luma-2024" },          // 1: email → links to member 1
  { name: "Bea New", email: "bea@example.com", source: "luma-2024" },            // 2: eligible
  { name: "Cy Bounce", email: "cy@example.com", source: "luma-2024" },           // 3: bounced
  { name: "Di Unsub", email: "di@example.com", source: "luma-2024" },            // 4: unsubscribed
  { name: "Ed Bad", email: "not-an-email", source: "luma-2024" },                // 5: invalid → none
  { name: "  jose   garcia ", email: null, headline: "VC", source: "linkedin-2026-10" }, // 6: name → member 2
  { name: "Sam Twin", email: null, headline: "Analyst", source: "linkedin-2026-10" },    // 7: two members → review
  { name: "Fay Done", email: "fay@example.com", source: "luma-2024", invitedAt: new Date() }, // 8: invited
]);
const { emailHash, suppress, queueableWhere, undeliverable } = await import(`${P}/lib/invites.ts`);
await suppress(db, "Cy@Example.com ", "bounce");
await suppress(db, "di@example.com", "unsubscribe");
const [h] = (await pg.query(`select encode(sha256(convert_to('nyubs-suppress:' || lower(trim(' CY@example.com')), 'UTF8')), 'hex') as h`)).rows as any[];
ok(h.h === emailHash("cy@example.com"), "SQL hash matches JS hash");
ok((await undeliverable(db, ["cy@example.com", "di@example.com"])).has("cy@example.com") && !(await undeliverable(db, ["di@example.com"])).size, "undeliverable = bounce/complaint only");

const { autoLinkContacts, nameMatches } = await import(`${P}/lib/contact-links.ts`);
const linked = await autoLinkContacts(db);
ok(linked.email.length === 1 && linked.email[0].contactId === 1, "auto-link by email (case-insensitive)");
ok(linked.name.length === 1 && linked.name[0].contactId === 6 && linked.name[0].memberId === 2, "auto-link by normalized name (accents, spaces)");
const { review } = await nameMatches(db);
ok(review.length === 1 && review[0].contact.id === 7 && review[0].candidates.length === 2, "ambiguous name goes to Needs a look");

const { listContacts } = await import(`${P}/lib/contacts-query.ts`);
const rows = await listContacts(db, {});
const st = Object.fromEntries(rows.map((r: any) => [r.c.id, r.invite]));
console.log("statuses", st);
ok(st[1] === "joined" && st[2] === "eligible" && st[3] === "bounced" && st[4] === "unsubscribed" && st[5] === "none" && st[8] === "invited", "invite statuses");
ok((await listContacts(db, { invite: "eligible" })).length === 1, "invite filter");
const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(contacts).where(sql`${contacts.source} = 'luma-2024' and ${queueableWhere()}`);
ok(n === 1, "eligible count (only Bea)");

// Queue: campaign over luma-2024, then a run with a stubbed Resend API.
await db.insert(settings).values({ key: "postal_address", value: "1 Example Street, New York, NY", updatedBy: "test" });
const [c] = await db.insert(inviteCampaigns).values({ status: "queued", source: "luma-2024", subject: "An invitation", body: "Hi {first_name},\n\nJoin us.", reason: "You registered for the 2024 NYU Blockchain Conference.", contentHash: "x", createdBy: "test" }).returning();
const q = await db.execute(sql`insert into invite_queue (campaign_id, contact_id) select ${c.id}, ${contacts.id} from ${contacts} where ${contacts.source} = 'luma-2024' and ${queueableWhere()} on conflict (contact_id) do nothing returning id`);
ok(q.rows.length === 1, "queued eligible contacts only");
const again = await db.execute(sql`insert into invite_queue (campaign_id, contact_id) select ${c.id}, ${contacts.id} from ${contacts} where ${contacts.source} = 'luma-2024' and ${queueableWhere()} on conflict (contact_id) do nothing returning id`);
ok(again.rows.length === 0, "a queued contact can't be queued again");
process.env.RESEND_API_KEY = "test";
const sentBodies: any[] = [];
globalThis.fetch = (async (_u: string, init: any) => { sentBodies.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); }) as any;
const { processInvites } = await import(`${P}/lib/invite-queue.ts`);
const r1 = await processInvites(db);
console.log("run 1", r1);
ok(r1.sent === 1, "processInvites sent 1");
const [bea] = await db.select().from(contacts).where(eq(contacts.id, 2));
ok(bea.invitedAt, "invited_at set");
const msg = sentBodies[0][0];
ok(msg.to[0] === "bea@example.com" && msg.headers["List-Unsubscribe"] && msg.text.includes("1 Example Street") && msg.text.includes("Hi Bea,"), "invite email: recipient, one-click header, postal address, first name");
const r2 = await processInvites(db);
ok(r2.sent === 0, "second run sends nothing (once ever)");
const [camp] = await db.select().from(inviteCampaigns).where(eq(inviteCampaigns.id, c.id));
ok(camp.status === "done", "campaign done");
const st2 = Object.fromEntries((await listContacts(db, {})).map((r: any) => [r.c.id, r.invite]));
ok(st2[2] === "invited", "Bea now invited");

// Invite token: pre-fill and link on join.
const { inviteToken } = await import(`${P}/lib/invite-email.ts`);
const { invitedEmail, spendInviteToken } = await import(`${P}/lib/invite-join.ts`);
const t = inviteToken(2);
ok((await invitedEmail(db, t)) === "bea@example.com", "token pre-fills the invited email");
const [m5] = await db.insert(members).values({ name: "Bea New", email: "bea.other@example.com", affiliation: "alumni" }).returning();
ok(await spendInviteToken(db, t, m5.id), "token links the contact on join (other address)");
ok(!(await spendInviteToken(db, t, m5.id)) && (await invitedEmail(db, t)) === null, "token is single-use");

// Check-in window and record.
const { checkinEvent, recordCheckin, isCheckedIn } = await import(`${P}/lib/checkin.ts`);
await db.insert(events).values([
  { title: "Now", slug: "now", startsAt: new Date(Date.now() + 60 * 60 * 1000), status: "published", createdBy: "t" },
  { title: "Later", slug: "later", startsAt: new Date(Date.now() + 5 * 3600 * 1000), status: "published", createdBy: "t" },
  { title: "Draft", slug: "draft", startsAt: new Date(), status: "draft", createdBy: "t" },
]);
ok((await checkinEvent(db, "now"))?.window === "open", "check-in open 1h before");
ok((await checkinEvent(db, "later"))?.window === "before", "check-in not open 5h before");
ok((await checkinEvent(db, "draft")) === null, "drafts have no check-in");
const ev = await checkinEvent(db, "now");
ok(await recordCheckin(db, ev.id, 1, "qr"), "check-in recorded");
ok(!(await recordCheckin(db, ev.id, 1, "qr")) && (await isCheckedIn(db, ev.id, 1)), "check-in once per member");
const audits = await db.select().from(adminAudit);
ok(audits.some((a: any) => a.action === "event.checkin" && a.actor === "system"), "check-in audited as system");

// Round 12.1: test check-ins apart from real ones; display links.
ok(await recordCheckin(db, ev.id, 1, "qr", "system", true), "test check-in recorded beside the real one");
ok(await isCheckedIn(db, ev.id, 1, true) && await isCheckedIn(db, ev.id, 1, false), "real and test check-ins are separate");
const [{ real }] = await db.select({ real: sql<number>`count(*) filter (where not ${eventCheckins.isTest})::int` }).from(eventCheckins);
ok(real === 1, "real count excludes test check-ins");
const draftEv = await checkinEvent(db, "draft", true);
ok(draftEv && draftEv.status === "draft", "test mode finds a draft");
const { createDisplayLink, displayAccess } = await import(`${P}/lib/display-links.ts`);
const link = await createDisplayLink(db, ev.id, "test");
ok((await displayAccess(db, "now", link.token)).ok, "display link opens its event while open");
ok(!(await displayAccess(db, "later", link.token)).ok, "display link refuses another event");
const laterEv = await checkinEvent(db, "later");
const l2 = await createDisplayLink(db, laterEv.id, "test");
const a2 = await displayAccess(db, "later", l2.token);
ok(!a2.ok && a2.reason === "closed", "display link closed outside the window");
await db.update(schema.displayLinks).set({ revokedAt: new Date() }).where(eq(schema.displayLinks.id, link.id));
const a3 = await displayAccess(db, "now", link.token);
ok(!a3.ok && a3.reason === "invalid", "revoked display link refused");
ok(!(await displayAccess(db, "now", "x".repeat(43))).ok, "unknown token refused");
// Round 13: conference inquiries.
const { saveInquiry, setInquiryStatus, InquiryInput } = await import(`${P}/lib/inquiries.ts`);
const input = InquiryInput.parse({ name: "Gus Sponsor", email: "gus@example.com", company: "", interest: "sponsor", message: "We'd like to sponsor the 2027 edition." });
ok(input.company === null, "blank company stored as null");
ok(!InquiryInput.safeParse({ ...input, message: "x".repeat(1001) }).success, "message over 1,000 characters refused");
const iq = await saveInquiry(db, input, "2027");
ok(await setInquiryStatus(db, iq, "replied", "admin@example.com"), "inquiry status changed");
ok(!(await setInquiryStatus(db, iq, "replied", "admin@example.com")), "same status is a no-op");
const iqAudit = (await db.select().from(adminAudit)).filter((a: any) => a.action === "inquiry.status");
ok(iqAudit.length === 1 && iqAudit[0].changes.status[1] === "replied", "status change logged with old and new");
const [iqRow] = await db.select().from(schema.conferenceInquiries);
ok(iqRow.edition === "2027" && iqRow.status === "replied", "inquiry stored with edition and status");
const [{ asMember }] = await db.select({ asMember: sql<number>`count(*)::int` }).from(members).where(eq(members.email, "gus@example.com"));
ok(asMember === 0, "an inquirer is not a member");
// Round 14: accelerator interest (founders and, since round 28, investors; old supporter rows stay).
const { parseInterest, saveInterest, founderAsMember } = await import(`${P}/lib/accelerator-interest.ts`);
const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x); return f; };
const founderForm = { name: "Fay Founder", email: "fay@example.com", affiliation: "other", company: "Example Labs", oneLiner: "Test company for the database check.", stage: "building", focus: ["ai", "finance", "ai"], url: "example.com" };
const pf = parseInterest("founder", fd(founderForm));
ok(pf.ok && pf.data.website === "https://example.com" && pf.data.focus.length === 2 && pf.data.addMember === false, "founder parsed: website gets https, focus deduped, no member by default");
ok(!parseInterest("founder", fd({ ...founderForm, focus: [] })).ok, "founder needs at least one focus");
ok(!parseInterest("founder", fd({ ...founderForm, stage: "series-z" })).ok, "unknown stage refused");
ok(!parseInterest("founder", fd({ ...founderForm, url: "not a site" })).ok, "bad website refused");
const ps = parseInterest("investor", fd({ name: "Ivy Investor", email: "sid@example.com", firm: "", focus: ["ai", "blockchain"] }));
ok(ps.ok && ps.data.firm === null && ps.data.focus.join() === "ai,blockchain", "investor parsed, blank firm is null");
ok(!parseInterest("investor", fd({ name: "Ivy", email: "sid@example.com", firm: "X", focus: ["crypto"] })).ok && !parseInterest("investor", fd({ name: "Ivy", email: "sid@example.com", firm: "X" })).ok, "investor focus required, unknown values refused");
// Supporter rows from before round 28 stay readable (the form is gone).
await db.insert(schema.acceleratorInterest).values({ type: "supporter", name: "Old Supporter", email: "oldsup@example.com", organization: "Example Org", help: ["mentor"] });
const fid = await saveInterest(db, (pf as any).data);
await saveInterest(db, (ps as any).data);
const [fRow] = await db.select().from(schema.acceleratorInterest).where(eq(schema.acceleratorInterest.id, fid));
ok(fRow.type === "founder" && fRow.status === "new" && fRow.oneLiner && fRow.focus.length === 2 && fRow.organization === null, "founder stored with status new");
const pm = parseInterest("founder", fd({ ...founderForm, affiliation: "alumni", addMember: "on" }));
const asM = founderAsMember((pm as any).data);
ok(pm.ok && (pm as any).data.addMember && asM.affiliation === "alumni" && asM.notify.join() === "accelerator" && asM.src === "accelerator-founder" && asM.blocks.join() === "ai,finance", "member checkbox joins with notify accelerator and src accelerator-founder");
ok(founderAsMember((pf as any).data).affiliation === "industry", "\"Other\" joins as an industry professional");
const [{ accMembers }] = await db.select({ accMembers: sql<number>`count(*)::int` }).from(members).where(sql`email in ('fay@example.com', 'sid@example.com')`);
ok(accMembers === 0, "accelerator interest alone makes nobody a member");
const { setInterestStatus, listInterest, parseInterestFilters } = await import(`${P}/lib/accelerator-interest.ts`);
ok(await setInterestStatus(db, fid, "contacted", "admin@example.com"), "accelerator status changed");
ok(!(await setInterestStatus(db, fid, "contacted", "admin@example.com")), "same accelerator status is a no-op");
const accAudit = (await db.select().from(adminAudit)).filter((a: any) => a.action === "accelerator.status");
ok(accAudit.length === 1 && accAudit[0].changes.status.join() === "new,contacted", "accelerator status change logged with old and new");
const flt = parseInterestFilters({ type: "founder", focus: "ai", stage: "nope" });
ok(flt.type === "founder" && flt.focus === "ai" && flt.stage === undefined, "unknown filter values ignored");
ok((await listInterest(db, flt)).length === 1 && (await listInterest(db, { focus: "blockchain", type: "founder" })).length === 0 && (await listInterest(db, { focus: "blockchain" })).length === 1, "focus filter matches founders' and investors' focus");
ok((await listInterest(db, { type: "investor", status: "new" })).length === 1 && (await listInterest(db, { type: "supporter" })).length === 1, "type and status filters (legacy supporters still listed)");
// Round 17: deleting inquiries (removal requests), logged without content.
const { deleteInquiry } = await import(`${P}/lib/inquiries.ts`);
const { deleteInterest } = await import(`${P}/lib/accelerator-interest.ts`);
ok(await deleteInquiry(db, iq, "super@example.com"), "conference inquiry deleted");
ok((await db.select().from(schema.conferenceInquiries).where(eq(schema.conferenceInquiries.id, iq))).length === 0, "inquiry row gone");
ok(!(await deleteInquiry(db, iq, "super@example.com")), "deleting it again is a no-op");
ok(await deleteInterest(db, fid, "super@example.com"), "accelerator row deleted");
const delAudit = (await db.select().from(adminAudit)).filter((a: any) => a.action === "inquiry.delete" || a.action === "accelerator.delete");
ok(delAudit.length === 2 && delAudit.every((a: any) => a.actor === "super@example.com" && a.createdAt && !/example\.com|sponsor the 2027|Example Labs|Fay|Gus/i.test(a.detail ?? "") && Object.keys(a.changes ?? {}).length === 0), "deletes logged with who, when and which, no content");
ok(delAudit.some((a: any) => a.detail === `Deleted conference inquiry #${iq}`) && delAudit.some((a: any) => a.detail === `Deleted accelerator founder #${fid}`), "audit names the inquiry");
// Round 19: contact messages.
const { ContactInput, saveContactMessage } = await import(`${P}/lib/contact-messages.ts`);
const cIn = ContactInput.parse({ name: "Pat Private", email: "pat@example.com", topic: "privacy_delete", message: "Please delete everything you hold about me." });
ok(!ContactInput.safeParse({ ...cIn, topic: "sales" }).success, "unknown contact topic refused");
ok(!ContactInput.safeParse({ ...cIn, message: "hi" }).success, "too-short contact message refused");
const cid = await saveContactMessage(db, cIn);
const [cRow] = await db.select().from(schema.contactMessages).where(eq(schema.contactMessages.id, cid));
ok(cRow.status === "new" && cRow.verifiedAt === null && cRow.topic === "privacy_delete", "contact message stored new and unverified");
const [{ cMembers }] = await db.select({ cMembers: sql<number>`count(*)::int` }).from(members).where(eq(members.email, "pat@example.com"));
ok(cMembers === 0, "a contact message makes nobody a member");
// Round 19: privacy requests are confirmed by a single-use, 48-hour emailed link.
const { sendContactVerification, verifyContactMessage } = await import(`${P}/lib/contact-messages.ts`);
const { createLinkToken } = await import(`${P}/lib/magic-link.ts`);
await sendContactVerification(db, cid, "pat@example.com"); // no RESEND_API_KEY here: nothing is sent
const cTokens = await db.select().from(schema.authTokens).where(eq(schema.authTokens.purpose, "contact"));
const hours = (cTokens[0]?.expiresAt.getTime() - Date.now()) / 3.6e6;
ok(cTokens.length === 1 && cTokens[0].subject === String(cid) && hours > 47.9 && hours <= 48, "one contact link for the request, valid 48 hours");
const tok = await createLinkToken(db, "contact", String(cid), 48 * 3600e3);
ok((await verifyContactMessage(db, tok)) === "confirmed", "confirmation link verifies the request");
const [cv] = await db.select().from(schema.contactMessages).where(eq(schema.contactMessages.id, cid));
ok(cv.verifiedAt instanceof Date, "request marked verified");
ok((await verifyContactMessage(db, tok)) === "invalid", "the link works only once");
const old = await createLinkToken(db, "contact", String(cid), -1000);
ok((await verifyContactMessage(db, old)) === "invalid", "an expired link is refused");
ok((await verifyContactMessage(db, "not-a-real-token-at-all-xxxxxxxxxx")) === "invalid", "an unknown link is refused");
const memberTok = await createLinkToken(db, "member", String(cid));
ok((await verifyContactMessage(db, memberTok)) === "invalid", "a link of another purpose can't verify a request");
const { setContactStatus, deleteContactMessage } = await import(`${P}/lib/contact-messages.ts`);
ok(await setContactStatus(db, cid, "replied", "super@example.com"), "contact message status changed");
const cAudit = (await db.select().from(adminAudit)).filter((a: any) => a.action === "contact_message.status");
ok(cAudit.length === 1 && cAudit[0].changes.status.join() === "new,replied", "contact status change logged with old and new");
const pendingTok = await createLinkToken(db, "contact", String(cid), 48 * 3600e3);
ok(await deleteContactMessage(db, cid, "super@example.com"), "contact message deleted");
ok((await verifyContactMessage(db, pendingTok)) === "closed", "a link for a deleted request says it's no longer open, never confirmed");
ok(!(await deleteContactMessage(db, cid, "super@example.com")), "deleting it again is a no-op");
const cDel = (await db.select().from(adminAudit)).filter((a: any) => a.action === "contact_message.delete");
ok(cDel.length === 1 && cDel[0].actor === "super@example.com" && cDel[0].detail === `Deleted contact message #${cid}` && Object.keys(cDel[0].changes ?? {}).length === 0, "contact delete logged with who, when and which, no content");
// Round 20: the shared bot guard. A real person filling a form normally is always kept.
const { formGuard, MIN_FILL_MS } = await import(`${P}/lib/form-guard.ts`);
const { sign } = await import(`${P}/lib/security.ts`);
const tokenAt = (msAgo: number) => sign(`f.${Date.now() - msAgo}`);
const warn = console.warn; const drops: string[] = []; console.warn = (m: string) => drops.push(m);
const kind = (g: any) => (g.kind === "ok" ? `ok:${g.spam ?? "clean"}` : g.kind);
ok(kind(formGuard("contact", tokenAt(MIN_FILL_MS + 500))) === "ok:clean", "a normal submit after a few seconds is kept");
ok(kind(formGuard("contact", tokenAt(60_000))) === "ok:clean", "a slow submit is kept");
ok(kind(formGuard("contact", tokenAt(300))) === "ok:too_fast", "an instant submit is kept, flagged");
ok(kind(formGuard("inquiry", tokenAt(1_000))) === "ok:too_fast", "under 2 seconds is too fast, whatever the form");
ok(kind(formGuard("contact", tokenAt(25 * 3600e3))) === "expired" && kind(formGuard("contact", "forged.token")) === "expired", "an old or forged token is refused");
console.warn = warn;
ok(drops.join("|") === "contact flagged: too_fast|inquiry flagged: too_fast", "each flag is logged as \"<form> flagged: too_fast\" only");
ok(MIN_FILL_MS === 2000, "the minimum time is 2 seconds");
// Round 20 (round 21: too fast is the only flag): suspected spam is saved and flagged, sends nothing, and "Not spam" sends the skipped
// email exactly once (through the real sendEmail and the stubbed Resend API above).
process.env.SUPER_ADMIN_EMAIL = "super@example.com";
const deferred: (() => Promise<unknown>)[] = [];
const defer = (w: () => Promise<unknown>) => { deferred.push(w); };
const flush = async () => { while (deferred.length) await deferred.shift()!(); };
const sends = () => sentBodies.length;
const lastSend = () => sentBodies[sentBodies.length - 1];
const { receiveInquiry, markInquiryNotSpam } = await import(`${P}/lib/inquiries.ts`);
const { receiveContact, markContactNotSpam } = await import(`${P}/lib/contact-messages.ts`);
const { receiveInterest, markInterestNotSpam } = await import(`${P}/lib/accelerator-interest.ts`);
const { savePendingJoin, approvePendingJoin, deletePendingJoin } = await import(`${P}/lib/pending-joins.ts`);

let s0 = sends();
const spamIq = await receiveInquiry(db, InquiryInput.parse({ name: "Hal Hasty", email: "hal@example.com", company: "", interest: "speak", message: "Sent faster than anyone types." }), "2027", "too_fast", defer);
await flush();
const [hal] = await db.select().from(schema.conferenceInquiries).where(eq(schema.conferenceInquiries.id, spamIq));
ok(hal && hal.suspectedSpam && hal.spamReason === "too_fast", "a too-fast inquiry is saved, flagged");
ok(sends() === s0, "a flagged inquiry sends no email");
await receiveInquiry(db, InquiryInput.parse({ name: "Cleo Clean", email: "cleo@example.com", company: "", interest: "other", message: "A normal message from a person." }), "2027", null, defer);
await flush();
ok(sends() === s0 + 1 && lastSend().to.includes("super@example.com"), "a clean inquiry sends its one notification");
s0 = sends();
ok(await markInquiryNotSpam(db, spamIq, "super@example.com"), "Not spam on the flagged inquiry");
ok(sends() === s0 + 1 && lastSend().to.includes("super@example.com") && lastSend().reply_to === "hal@example.com", "Not spam sends the skipped notification, Reply to the sender");
ok(!(await markInquiryNotSpam(db, spamIq, "super@example.com")) && sends() === s0 + 1, "a second Not spam sends nothing");
const [hal2] = await db.select().from(schema.conferenceInquiries).where(eq(schema.conferenceInquiries.id, spamIq));
ok(!hal2.suspectedSpam, "the inquiry is normal now");

s0 = sends();
const spamMsg = await receiveContact(db, ContactInput.parse({ name: "Tia Toofast", email: "tia@example.com", topic: "privacy_access", message: "Send me what you hold about me." }), "too_fast", defer);
await flush();
const tiaTokens = await db.select().from(schema.authTokens).where(and(eq(schema.authTokens.purpose, "contact"), eq(schema.authTokens.subject, String(spamMsg))));
ok(sends() === s0 && tiaTokens.length === 0, "a flagged privacy request sends neither the confirmation nor the notification");
ok(await markContactNotSpam(db, spamMsg, "super@example.com"), "Not spam on the flagged message");
const two = sentBodies.slice(s0).map((b: any) => b.to).flat();
ok(sends() === s0 + 2 && two.includes("tia@example.com") && two.includes("super@example.com"), "Not spam sends the skipped confirmation link and notification");
ok(!(await markContactNotSpam(db, spamMsg, "super@example.com")) && sends() === s0 + 2, "a second Not spam sends nothing");

s0 = sends();
const spamSup = await receiveInterest(db, (parseInterest("investor", fd({ name: "Sam Spam", email: "samspam@example.com", firm: "Example Fund", focus: ["ai"] })) as any).data, "too_fast", defer);
await flush();
ok(sends() === s0, "a flagged accelerator form sends no email");
ok((await db.select().from(contacts).where(eq(contacts.email, "samspam@example.com"))).length === 0, "a flagged accelerator form creates no contact");
ok(await markInterestNotSpam(db, spamSup, "super@example.com") && sends() === s0 + 1, "Not spam sends its notification");
const [samC] = await db.select().from(contacts).where(eq(contacts.email, "samspam@example.com"));
ok(samC && samC.source === "investor-list" && samC.contactType === "vc", "Not spam creates the contact it skipped");
ok(!(await markInterestNotSpam(db, spamSup, "super@example.com")) && sends() === s0 + 1, "once only");

// Joins: a flagged join is never a member until approved; approving joins once (welcome via the join).
const membersBefore = (await db.select().from(members)).length;
const [anyEvent] = await db.select().from(events).limit(1);
const pj = await savePendingJoin(db, { kind: "checkin", name: "Pia Pending", email: "pia@example.com", affiliation: "alumni", blocks: [], notify: [], source: "event-test", eventId: anyEvent.id, spamReason: "too_fast" });
ok((await db.select().from(members)).length === membersBefore, "a flagged join creates no member");
let welcomes = 0;
const fakeJoin = async (d: any, m: any) => { const [r] = await d.insert(members).values({ name: m.name, email: m.email, affiliation: m.affiliation, blocks: m.blocks, notify: m.notify, source: m.src }).returning(); welcomes++; return { id: r.id, inserted: true }; };
const newId = await approvePendingJoin(db, pj, "super@example.com", fakeJoin);
ok(newId && welcomes === 1 && (await db.select().from(members)).length === membersBefore + 1, "Not spam on a pending join makes one member (and its welcome email)");
ok((await approvePendingJoin(db, pj, "super@example.com", fakeJoin)) === null && welcomes === 1, "a second Not spam does nothing");
const [pjCheckin] = await db.select().from(eventCheckins).where(and(eq(eventCheckins.memberId, newId), eq(eventCheckins.eventId, anyEvent.id)));
ok(pjCheckin?.method === "admin" && !pjCheckin.isTest, "an approved check-in join of a new member is checked in (method admin)");
const pj2 = await savePendingJoin(db, { kind: "join", name: "Del Ete", email: "del@example.com", affiliation: "student", blocks: ["ai"], notify: [], source: null, eventId: null, spamReason: "too_fast" });
ok(await deletePendingJoin(db, pj2, "super@example.com"), "a pending join can be deleted");
const spamAudit = (await db.select().from(adminAudit)).filter((a: any) => /not_spam|pending\.delete/.test(a.action));
ok(spamAudit.length === 5 && spamAudit.every((a: any) => a.actor === "super@example.com" && !/@example\.com|Hal|Tia|Pia|Sam|faster|privacy|Send me/i.test(a.detail ?? "")), "Not spam and delete are logged without content");
// Round 21: no honeypot; validation never wipes the form; too fast is flagged, never dropped.
{
  const { submitContact } = await import(`${P}/app/actions/contact.ts`);
  const { submitFounder } = await import(`${P}/app/actions/accelerator.ts`);
  const short = fd({ formToken: tokenAt(5_000), name: "Val Idate", email: "val@example.com", topic: "general", message: "short" });
  const r: any = await submitContact(null, short);
  ok(!r.ok && r.fieldErrors?.message === "Tell us a little more (at least 10 characters)." && Object.keys(r.fieldErrors).length === 1, "a short message returns its error, keyed to the message field");
  ok(r.values?.name === "Val Idate" && r.values?.email === "val@example.com" && r.values?.message === "short" && r.values?.topic === "general" && !("formToken" in r.values), "the error answer carries back what was typed (never the form token)");
  const rf: any = await submitFounder(null, fd({ formToken: tokenAt(5_000), name: "Fay", email: "nope", affiliation: "alumni", company: "", oneLiner: "x", stage: "idea", url: "not a site" }));
  ok(!rf.ok && rf.fieldErrors?.email && rf.fieldErrors?.company && rf.fieldErrors?.oneLiner && rf.fieldErrors?.focus && rf.fieldErrors?.url && rf.values?.name === "Fay", "every founder field error is keyed to its form field (website → url), input kept");

  // A normal submission saves an unflagged row and sends the notification ...
  const g1 = formGuard("contact", tokenAt(5_000));
  ok(g1.kind === "ok" && g1.spam === null, "a normal submission is not flagged");
  let s1 = sends();
  const okId = await receiveContact(db, ContactInput.parse({ name: "Nora Normal", email: "nora@example.com", topic: "general", message: "A normal question, typed by a person." }), (g1 as any).spam, defer);
  await flush();
  const [nora] = await db.select().from(schema.contactMessages).where(eq(schema.contactMessages.id, okId));
  ok(nora && !nora.suspectedSpam && nora.spamReason === null, "it is saved unflagged");
  ok(sends() === s1 + 1 && lastSend().to.includes("super@example.com") && lastSend().reply_to === "nora@example.com", "and sends the notification, Reply to the sender");
  // ... and a too-fast one saves a flagged row and sends nothing.
  const g2 = formGuard("contact", tokenAt(400));
  ok(g2.kind === "ok" && g2.spam === "too_fast", "a too-fast submission is flagged, not dropped");
  s1 = sends();
  const fastId = await receiveContact(db, ContactInput.parse({ name: "Quinn Quick", email: "quinn@example.com", topic: "general", message: "Sent in under two seconds." }), (g2 as any).spam, defer);
  await flush();
  const [quinn] = await db.select().from(schema.contactMessages).where(eq(schema.contactMessages.id, fastId));
  ok(quinn && quinn.suspectedSpam && quinn.spamReason === "too_fast", "it is saved, flagged too_fast");
  ok(sends() === s1, "and sends nothing");
}
// Members by country: matched against the country list, display only (round 22).
{
  const { membersByCountry } = await import(`${P}/lib/members-query.ts`);
  const [a, b, c] = await db.insert(members).values([
    { name: "City Only", email: "city@example.com", affiliation: "alumni", location: "New York City", country: "New York City" },
    { name: "State Twice", email: "state@example.com", affiliation: "alumni", location: "New York, New York", country: "New York" },
    { name: "Nowhere Known", email: "nowhere@example.com", affiliation: "alumni", location: "Atlantis", country: "Atlantis" },
  ]).returning();
  const counts = await membersByCountry(db);
  const rows = await db.select().from(members).where(sql`id in (${a.id}, ${b.id}, ${c.id})`).orderBy(members.id);
  ok(rows[0].country === "United States" && rows[1].country === "United States", "a city with no comma and \"New York, New York\" count as United States");
  ok(rows[2].country === "Unrecognized", "an entry with no matching country counts as Unrecognized");
  ok(rows[0].location === "New York City" && rows[1].location === "New York, New York" && rows[2].location === "Atlantis", "what members typed is never changed");
  ok(!counts.some((x: any) => x.country === "New York City" || x.country === "New York"), "no city or state tiles in Members by country");
  await db.delete(members).where(sql`id in (${a.id}, ${b.id}, ${c.id})`);
}
// Daily admin digest (round 22): waiting first, names but never addresses, recipients limited to
// active organizers, suppressions skipped, one per day, nothing on a quiet day.
{
  const { runDigest, digestRecipients, buildDigest } = await import(`${P}/lib/digest.ts`);
  const { adminUsers, pendingJoins: pj } = schema;
  await db.insert(adminUsers).values([
    { email: "org@example.com", role: "admin", addedBy: "test" },
    { email: "gone@example.com", role: "admin", addedBy: "test", removedAt: new Date() },
    { email: "bounced@example.com", role: "admin", addedBy: "test" },
  ]);
  await db.insert(settings).values({ key: "digest_recipients", value: "org@example.com\ngone@example.com\nstranger@example.com\nbounced@example.com", updatedBy: "test" })
    .onConflictDoUpdate({ target: settings.key, set: { value: "org@example.com\ngone@example.com\nstranger@example.com\nbounced@example.com" } });
  const to = await digestRecipients(db);
  ok(to.join() === "super@example.com,org@example.com,bounced@example.com", "digest recipients: the super admin plus listed active organizers only");
  await suppress(db, "bounced@example.com", "bounce");
  await db.insert(pj).values({ kind: "join", name: "Wanda Waiting", email: "wanda@example.com", affiliation: "alumni", spamReason: "too_fast", createdAt: new Date(Date.now() - 3 * 86400000) });
  await db.insert(members).values({ name: "Newt Newcomer", email: "newt@example.com", affiliation: "industry", source: "ref-linkedin.com" });
  const d = await buildDigest(db);
  ok(d.waiting.some((x: string) => x.startsWith("Join: Wanda Waiting (Alumni)") && x.endsWith("waiting 3 days")), "a pending join is listed with how long it has waited");
  ok(d.newMembers.some((x: string) => x === "Newt Newcomer · Industry professional · source ref-linkedin.com"), "a new member is listed with affiliation and source");
  const before = sends();
  const r = await runDigest(db);
  const batch = sentBodies.slice(before).flat();
  ok(r.sent === 2 && r.skipped === 1 && batch.length === 2, "the digest goes to each recipient once, skipping a bounced address");
  const html: string = batch[0]?.html ?? "";
  ok(html.indexOf("Waiting for review") > -1 && html.indexOf("Waiting for review") < html.indexOf("New members"), "waiting for review comes first");
  ok(!/wanda@|newt@|ana@example/.test(html + batch[0]?.text), "no member or sender email address in the digest");
  const [log] = await db.select().from(adminAudit).where(eq(adminAudit.action, "digest.send"));
  ok(log && log.detail === "Daily digest sent to 2 recipients (1 skipped: bounced or spam)", "the send is logged with the recipient count only");
  ok((await runDigest(db)).note === "already sent today" && sends() === before + 1, "a second run the same day sends nothing");
  // A quiet day: nothing waiting, nothing new since the last digest.
  await db.delete(pj);
  for (const t of [schema.conferenceInquiries, schema.acceleratorInterest, schema.contactMessages]) await db.update(t).set({ suspectedSpam: false });
  await db.update(schema.contactMessages).set({ status: "closed" });
  const quiet = await runDigest(db, new Date(Date.now() + 2 * 86400000));
  ok(quiet.note === "quiet day" && sends() === before + 1, "a quiet day sends nothing");
}
// Round 23: admin paging (100 per page) keeps the filters; counts match the filters.
{
  const { listContacts, countContacts } = await import(`${P}/lib/contacts-query.ts`);
  const { listMembers, countMembers } = await import(`${P}/lib/members-query.ts`);
  const { pageWindow } = await import(`${P}/lib/paging.ts`);
  await db.insert(contacts).values(Array.from({ length: 150 }, (_, i) => ({ name: `Pager Person ${i}`, email: `pager${i}@example.com`, source: "pager-test" })));
  const f = { source: "pager-test" };
  const total = await countContacts(db, f);
  const w = pageWindow(2, total);
  const p2 = await listContacts(db, f, { limit: 100, offset: w.offset });
  ok(total === 150 && w.last === 2 && p2.length === 50 && p2.every((r: any) => r.c.source === "pager-test"), "contacts page 2 holds the last 50 of 150, filter kept");
  const p1 = await listContacts(db, f, { limit: 100, offset: 0 });
  ok(p1.length === 100 && !p1.some((r: any) => p2.some((x: any) => x.c.id === r.c.id)), "pages don't overlap");
  ok(pageWindow(9, total).page === 2 && pageWindow(1, 0).last === 1, "a page past the end shows the last one");
  ok((await countMembers(db, {})) === (await listMembers(db, {})).length, "member count matches the unpaged list");
  await db.delete(contacts).where(eq(contacts.source, "pager-test"));
}
// Round 25: contacts import with company, source and notes columns; dry run, then fill-empty-only matching.
{
  const { parseCsv } = await import(`${P}/lib/csv.ts`);
  const { guessMapping, headerRowIndex, formatOf, slugifySource, newNoteLines, SOURCE_RE } = await import(`${P}/lib/contacts-import.ts`);
  const { planImport, applyImport } = await import(`${P}/lib/contacts-import-plan.ts`);
  // Parser and column guesses: unknown columns are ignored; utm_source is never the source column.
  const csv = "﻿name,email,company,title,source,notes,favourite colour,utm_source\r\n" +
    "New Person,new1@example.com,\"Example, Inc.\",Analyst,via Alex Example,Met at the mixer,blue,x\r\n" +
    "Filled Name, MATCH1@Example.com ,New Co,New title,via Alex Example,Follow up,,\r\n" +
    "Other Name,match2@example.com,Other Co,,VIA alex example,,,\r\n" +
    "No Email,,Some Co,,via Alex Example,,,\r\n" +
    "Bad Email,bad@,,,,,,\r\n" +
    "Twice,NEW1@example.com,,,,,,\r\n" +
    "Label Person,new2@example.com,,,,,,\r\n";
  const table = parseCsv(csv);
  const h = headerRowIndex(table);
  const headers = table[h], data = table.slice(h + 1);
  const m = guessMapping(headers);
  ok(h === 0 && data.length === 7 && data[0][2] === "Example, Inc.", "CSV parser: BOM, CRLF and quoted commas");
  ok(m.name === 0 && m.email === 1 && m.company === 2 && m.headline === 3 && m.source === 4 && m.notes === 5 && m.checkIn === -1, "guessMapping finds name, email, company, title, source and notes");
  ok(formatOf(headers) === "list" && guessMapping(["Name", "Email", "utm_source", "Company name"]).source === -1 && guessMapping(["Name", "Company name"]).company === 1, "unknown columns ignored; utm_source isn't a source; 'Company name' is the company");
  // Slugify.
  ok(slugifySource("via Alex Example") === "via-alex-example" && slugifySource("  Vía  José! ") === "via-jose" && slugifySource("---") === "" && slugifySource(undefined) === "", "slugifySource: lowercase, accents stripped, dashes, empty stays empty");
  const long = slugifySource("a".repeat(39) + " b c");
  ok(long.length <= 40 && SOURCE_RE.test(long) && SOURCE_RE.test(slugifySource("via Alex Example")), "slugified sources fit SOURCE_RE (40 characters, no trailing dash)");
  ok(newNoteLines("2026-01-01: Follow up", ["Follow up", " New one ", ""], "2026-10-16") === "2026-10-16: New one" && newNoteLines(null, [""]) === null, "notes: dated lines, a note already there isn't added twice");

  await db.insert(contacts).values([
    { name: null, email: "match1@example.com", headline: "Old title", source: "luma-2024", notes: "2026-01-01: Old note" },
    { name: "Kept Name", email: "match2@example.com", company: "Kept Co", source: "via-alex-example", checkedIn: true },
  ]);
  const membersBefore = (await db.select().from(members)).length;
  const emailsBefore = (await db.select().from(schema.emailLog)).length;
  const contactsBefore = (await db.select().from(contacts)).length;
  // Dry run without a label: one row has no source of its own; nothing is written.
  const dry = await planImport(db, data, m, "", "list", "2026-10-16");
  ok(dry.missingSource === 1 && (await db.select().from(contacts)).length === contactsBefore, "dry run writes nothing and counts rows needing a label");
  const plan = await planImport(db, data, m, "fake-list", "list", "2026-10-16");
  const c = plan.counts;
  ok(c.total === 7 && c.created === 2 && c.matched === 2 && c.updated === 1 && c.skipped === 3 && plan.missingSource === 0, "dry run counts: 2 new, 2 matched (1 updated), 3 skipped");
  ok(c.bySource["via-alex-example"] === 3 && c.bySource["fake-list"] === 1, "per-row sources: a row's own source wins over the label");
  const reasons = plan.rows.filter((r: any) => r.action === "skip").map((r: any) => `${r.line}:${r.reason}`).join(",");
  ok(reasons === "4:Missing email,5:Invalid email,6:Duplicate in file", "skipped rows carry their reason");
  ok(plan.rows.every((r: any) => !/@example\.com/.test(r.email)) && plan.rows[1].action === "match", "preview emails are masked; matched case-insensitive and trimmed");

  ok((await applyImport(db, plan)) === 2, "import creates the new contacts");
  const by = async (e: string) => (await db.select().from(contacts).where(sql`lower(${contacts.email}) = ${e}`))[0];
  const n1 = await by("new1@example.com"), n2 = await by("new2@example.com"), m1 = await by("match1@example.com"), m2 = await by("match2@example.com");
  ok(n1.source === "via-alex-example" && n1.company === "Example, Inc." && n1.headline === "Analyst" && n1.notes === "2026-10-16: Met at the mixer" && n2.source === "fake-list" && n2.notes === null, "new contacts get company, title, source and a dated note");
  ok(m1.name === "Filled Name" && m1.company === "New Co" && m1.headline === "Old title" && m1.source === "luma-2024", "a match fills empty fields only and keeps its source");
  ok(m1.notes === "2026-01-01: Old note\n2026-10-16: Follow up\n2026-10-16: Also from via-alex-example", "notes are appended, with the new source noted");
  ok(m2.name === "Kept Name" && m2.company === "Kept Co" && m2.checkedIn === true && m2.notes === null, "filled fields are never overwritten (same source: no note)");
  const again = await planImport(db, data, m, "fake-list", "list", "2026-10-16");
  ok(again.counts.created === 0 && again.counts.matched === 4 && again.counts.updated === 0, "importing the same file again changes nothing");
  ok((await db.select().from(members)).length === membersBefore && (await db.select().from(schema.emailLog)).length === emailsBefore, "imports create no members and send no email");
  // The LinkedIn group export still imports rows without emails (name + headline).
  const li = parseCsv("Name,Title / Headline,Group role\nLi Person,Builder,Member\n");
  const liPlan = await planImport(db, li.slice(1), guessMapping(li[0]), "linkedin-2026-10", formatOf(li[0]), "2026-10-16");
  ok(formatOf(li[0]) === "linkedin" && liPlan.counts.created === 1 && liPlan.counts.skipped === 0, "LinkedIn exports keep importing without emails");
  await db.delete(contacts).where(sql`lower(${contacts.email}) in ('new1@example.com', 'new2@example.com', 'match1@example.com', 'match2@example.com')`);
}
// Round 26: personal introductions (source "via-…") are never queued or sent without the explicit choice of that source.
{
  const { queueableWhere } = await import(`${P}/lib/invites.ts`);
  const { queueCampaign, processInvites } = await import(`${P}/lib/invite-queue.ts`);
  const { listContacts } = await import(`${P}/lib/contacts-query.ts`);
  const ids = await db.insert(contacts).values([
    { name: "Intro One", email: "intro1@example.com", source: "via-alex-example" },
    { name: "Intro Two", email: "intro2@example.com", source: "via-alex-example" },
    { name: "Intro Other", email: "intro3@example.com", source: "via-sam-example" },
    { name: "List Person", email: "list1@example.com", source: "fake-intros-list" },
  ]).returning({ id: contacts.id });
  const [i1, i2, i3, l1] = ids.map((x: any) => x.id);
  const queueable = async (personal: string | null = null) =>
    (await db.select({ id: contacts.id }).from(contacts).where(queueableWhere(personal))).map((x: any) => x.id);
  const all = await queueable();
  ok(all.includes(l1) && ![i1, i2, i3].some((id) => all.includes(id)), "by default no via- contact is queueable");
  const chosen = await queueable("via-alex-example");
  ok(chosen.includes(i1) && chosen.includes(i2) && !chosen.includes(i3), "choosing one via- source includes only that source");
  ok(!(await queueable("fake-intros-list")).includes(i1), "naming a non-personal source never includes via- contacts");
  const st = Object.fromEntries((await listContacts(db, {})).map((r: any) => [r.c.id, r.invite]));
  ok(st[i1] === "personal" && st[i3] === "personal" && st[l1] === "eligible", "invite status: Personal (not auto-invited)");
  ok((await listContacts(db, { invite: "personal" })).length === 3, "Invite filter: personal");

  const camp = async (source: string, includePersonal: boolean) =>
    (await db.insert(inviteCampaigns).values({ status: "queued", source, includePersonal, subject: "An invitation", body: "Hi {first_name},\n\nJoin us.", reason: "Test reason.", contentHash: `p-${source}-${includePersonal}`, createdBy: "test" }).returning())[0];
  const notChosen = await camp("via-alex-example", false);
  ok((await queueCampaign(db, notChosen.id, "via-alex-example", false)) === 0, "a via- source without the explicit choice queues nobody");
  const general = await camp("fake-intros-list", false);
  ok((await queueCampaign(db, general.id, "fake-intros-list", false)) === 1, "other sources queue as before");

  // Even a via- contact that ended up in a campaign's queue without the choice is never sent: the run skips it.
  await db.insert(schema.inviteQueue).values({ campaignId: general.id, contactId: i2 });
  process.env.RESEND_API_KEY = "test";
  const to: string[] = [];
  globalThis.fetch = (async (_u: string, init: any) => { for (const m of JSON.parse(init.body)) to.push(...m.to); return new Response("{}", { status: 200 }); }) as any;
  const r1 = await processInvites(db);
  const [c2] = await db.select().from(contacts).where(eq(contacts.id, i2));
  ok(to.includes("list1@example.com") && !to.includes("intro2@example.com") && !c2.invitedAt && r1.skipped >= 1, "the run skips a via- contact in a campaign that didn't include it");

  // Explicitly chosen and confirmed: that source only.
  const explicit = await camp("via-alex-example", true);
  ok((await queueCampaign(db, explicit.id, "via-alex-example", true)) === 1, "explicit choice queues that source's remaining introductions");
  await processInvites(db);
  ok(to.includes("intro1@example.com") && !to.includes("intro3@example.com"), "explicit campaign sends its own source only");
}
// Round 27: member nodes in the background. Below 50 (no count in /api/chain) a fixed baseline with
// no accent; from 50 one node per member (capped), in their own accent; the "new" pulses are a fixed few.
{
  const { densityFor, AMBIENT_MEMBER_NODES, MAX_MEMBER_NODES, RECENT_PULSES } = await import(`${P}/components/backdrop/network.ts`);
  const hidden = densityFor(1440, 900, null), sixty = densityFor(1440, 900, 60), many = densityFor(1440, 900, 300), phone = densityFor(390, 844, 300);
  ok(hidden.members === AMBIENT_MEMBER_NODES && !hidden.accent, "below 50: the ambient baseline, no accent (members can't be told apart)");
  ok(sixty.members === 60 && sixty.accent && many.members === MAX_MEMBER_NODES && phone.members === MAX_MEMBER_NODES / 2, "from 50: one node per member, capped (phones half), with the accent");
  ok(hidden.pulses === RECENT_PULSES && many.pulses === RECENT_PULSES && phone.pulses === RECENT_PULSES - 1, "recent pulses are a fixed number, whatever the count");
}

// Round 28: investor-network fields on contacts, quick-add, and accelerator submissions as contacts.
{
  const F = await import(`${P}/lib/contact-fields.ts`);
  const { guessMapping, MAPPING_KEYS } = await import(`${P}/lib/contacts-import.ts`);
  const { planImport, applyImport } = await import(`${P}/lib/contacts-import-plan.ts`);
  const { parseCsv } = await import(`${P}/lib/csv.ts`);
  const { saveContact, findContact, fillContact, parseQuickAdd, draftOf, organizerSource } = await import(`${P}/lib/contact-save.ts`);
  const { listContacts, investorNetwork } = await import(`${P}/lib/contacts-query.ts`);
  const { queueableWhere } = await import(`${P}/lib/invites.ts`);
  const { parseInterest, receiveInterest, investorType } = await import(`${P}/lib/accelerator-interest.ts`);
  const byEmail = async (e: string) => (await db.select().from(contacts).where(sql`lower(${contacts.email}) = ${e}`))[0];

  // Defaults from the migration.
  const [plain] = await db.insert(contacts).values({ name: "Plain Default", email: "plain@example.com", source: "fake-r28" }).returning();
  ok(plain.relationship === "cold" && plain.focus.length === 0 && plain.contactType === null && plain.nyuAlum === null && plain.lastTouchAt === null, "new columns default: Cold, no focus, type and NYU alum unknown, no last touch");

  // Lenient readers.
  const li = F.normalizeLinkedin;
  ok(li("linkedin.com/in/Ex-Ample/") === "https://www.linkedin.com/in/ex-ample" && li("https://uk.linkedin.com/in/ex-ample?trk=x") === li("http://www.linkedin.com/in/ex-ample") && li("https://example.com/in/x") === null && li("") === null, "LinkedIn URLs normalized; other sites refused");
  ok(F.parseContactType("LP / family office") === "lp" && F.parseContactType("Corporate VC") === "cvc" && F.parseContactType(" vc ") === "vc" && F.parseContactType("bank") === null, "type labels read, unknown left empty");
  ok(F.parseInvestorStage("Series A+") === "series_a" && F.parseInvestorStage("Pre-seed") === "pre_seed" && F.parseInvestorStage("Multi-stage") === "multi" && F.parseInvestorStage("late") === null, "stage labels read");
  ok(F.parseFocus("AI, Blockchain") .join() === "blockchain,ai" && F.parseFocus("finance and ai").join() === "finance,ai" && F.parseFocus("crypto").length === 0, "focus read as block tags");
  ok(F.parseNyuAlum("Yes") === true && F.parseNyuAlum("no") === false && F.parseNyuAlum("?") === null, "NYU alum yes / no / unknown");
  ok(F.laterRelationship("met", "replied") === "met" && F.laterRelationship("cold", "contacted") === "contacted", "a relationship only moves forward");

  // Import with the new columns: new rows get them; a match fills only what's empty and never moves a relationship back.
  await db.insert(contacts).values({ name: "Known Investor", email: "known@example.com", source: "via-alex-example", contactType: "angel", relationship: "met", company: "Kept Fund" });
  await db.insert(contacts).values({ name: "Cold Investor", email: "cold@example.com", source: "fake-r28" });
  const csv = parseCsv("name,email,company,type,focus,stage,linkedin url,nyu alum,relationship,notes\n" +
    "New Vc,newvc@example.com,Example Ventures,VC,\"Blockchain, AI\",Seed,linkedin.com/in/new-vc,yes,Contacted,Met at the mixer\n" +
    "Known Investor,KNOWN@example.com,Other Fund,VC,Finance,Series A+,,no,Replied,\n" +
    "Cold Investor,cold@example.com,,LP / family office,,,,,contacted,\n" +
    "Odd Values,odd@example.com,,bank,crypto,late,example.com/x,maybe,friends,\n");
  const m = guessMapping(csv[0]);
  ok(MAPPING_KEYS.length === 13 && m.contactType === 3 && m.focus === 4 && m.stage === 5 && m.linkedin === 6 && m.nyuAlum === 7 && m.relationship === 8, "guessMapping finds type, focus, stage, LinkedIn URL, NYU alum and relationship");
  const plan = await planImport(db, csv.slice(1), m, "fake-r28", "list", "2026-10-17");
  ok(plan.counts.created === 2 && plan.counts.matched === 2 && plan.counts.updated === 2, "import plan: 2 new, 2 matched and updated");
  await applyImport(db, plan);
  const nv = await byEmail("newvc@example.com"), kn = await byEmail("known@example.com"), cd = await byEmail("cold@example.com"), od = await byEmail("odd@example.com");
  ok(nv.contactType === "vc" && nv.focus.join() === "blockchain,ai" && nv.stage === "seed" && nv.linkedinUrl === "https://www.linkedin.com/in/new-vc" && nv.nyuAlum === true && nv.relationship === "contacted" && nv.lastTouchAt === "2026-10-17", "new contact gets every investor field and its note's date as last touch");
  ok(kn.contactType === "angel" && kn.company === "Kept Fund" && kn.relationship === "met" && kn.focus.join() === "finance" && kn.stage === "series_a" && kn.nyuAlum === false && kn.source === "via-alex-example", "a match fills empty fields only and never moves a relationship back");
  ok(kn.notes === "2026-10-17: Also from fake-r28" && kn.lastTouchAt === null, "an 'Also from' line isn't a touch");
  ok(cd.relationship === "contacted" && cd.contactType === "lp", "Cold moves forward to Contacted");
  ok(od.contactType === null && od.focus.length === 0 && od.stage === null && od.linkedinUrl === null && od.nyuAlum === null && od.relationship === "cold", "unknown values are left empty, never guessed");

  // Type and relationship never change invite eligibility; via- stays personal.
  const queueable = (await db.select({ e: contacts.email }).from(contacts).where(queueableWhere())).map((x: any) => x.e);
  ok(queueable.includes("newvc@example.com") && queueable.includes("cold@example.com") && queueable.includes("plain@example.com") && !queueable.includes("known@example.com"), "investor fields don't change eligibility; via- contacts stay out of bulk invites");

  // Filters and the dashboard counts.
  const ids = async (f: any) => (await listContacts(db, f)).map((r: any) => r.c);
  const [fv, ff, fs, fr] = [await ids({ type: "vc" }), await ids({ focus: "ai" }), await ids({ stage: "series_a" }), await ids({ relationship: "met" })];
  ok(fv.every((c: any) => c.contactType === "vc") && fv.some((c: any) => c.id === nv.id) && !fv.some((c: any) => c.id === kn.id)
    && ff.every((c: any) => c.focus.includes("ai")) && ff.some((c: any) => c.id === nv.id) && !ff.some((c: any) => c.id === kn.id)
    && fs.length === 1 && fs[0].id === kn.id && fr.length === 1 && fr[0].id === kn.id, "filters: type, focus, stage, relationship");
  ok((await listContacts(db, { type: "none", q: "plain@example.com" })).length === 1, "type filter: not set");
  const net = await investorNetwork(db);
  const cell = (t: string, r: string) => net.find((x: any) => x.type === t && x.relationship === r)?.n ?? 0;
  const [{ typed }] = await db.select({ typed: sql<number>`count(*)::int` }).from(contacts).where(sql`${contacts.contactType} is not null`);
  ok(cell("vc", "contacted") === 1 && cell("angel", "met") === 1 && cell("lp", "contacted") === 1 && net.every((x: any) => x.type) && net.reduce((a: number, x: any) => a + x.n, 0) === typed, "investor network counts by type and relationship, typed contacts only");

  // Quick-add.
  ok(organizerSource("alex.organizer@example.com") === "via-alex-organizer", "default source is via-<organizer>");
  const qa = (o: Record<string, string | string[]>) => parseQuickAdd(fd({ name: "", email: "", company: "", headline: "", linkedinUrl: "", contactType: "", stage: "", nyuAlum: "", relationship: "cold", note: "", source: "via-alex-organizer", ...o }));
  ok(!qa({ name: "No Link", linkedinUrl: "example.com/in/x" }).ok && !qa({ name: "Bad Source", source: "Via Alex!" }).ok && !qa({}).ok && !qa({ name: "X", contactType: "bank" }).ok, "quick-add refuses a non-LinkedIn URL, a bad source, no name, an unknown type");
  const linkOnly = qa({ name: "Lin Only", linkedinUrl: "linkedin.com/in/lin-only", contactType: "angel", focus: ["finance"], nyuAlum: "yes", relationship: "contacted", note: "Intro from a friend", company: "Example Angels" });
  ok(linkOnly.ok && (linkOnly as any).data.email === null && (linkOnly as any).data.nyuAlum === true, "a LinkedIn-only person is fine");
  const r1 = await saveContact(db, draftOf((linkOnly as any).data), (linkOnly as any).data.note, "2026-10-17");
  const lo = (await db.select().from(contacts).where(eq(contacts.id, r1.id)))[0];
  ok(r1.created && lo.email === null && lo.source === "via-alex-organizer" && lo.notes === "2026-10-17: Intro from a friend" && lo.lastTouchAt === "2026-10-17", "quick-add creates the contact with a dated first note");
  const again = qa({ name: "Lin Only", linkedinUrl: "https://www.LinkedIn.com/in/Lin-Only/", email: "lin@example.com", company: "Other Co", headline: "Partner", relationship: "cold", note: "Second coffee" });
  const found = await findContact(db, draftOf((again as any).data));
  ok(found?.id === r1.id, "the same person is found by LinkedIn URL (any form of it)");
  const filled = await fillContact(db, found, draftOf((again as any).data), "Second coffee", "2026-10-18");
  const lo2 = (await db.select().from(contacts).where(eq(contacts.id, r1.id)))[0];
  ok(lo2.company === "Example Angels" && lo2.headline === "Partner" && lo2.email === "lin@example.com" && lo2.relationship === "contacted" && lo2.notes.endsWith("2026-10-18: Second coffee") && lo2.lastTouchAt === "2026-10-18", "fill: empty fields and the email filled, company kept, relationship not moved back, note appended, last touch moved");
  ok(filled.includes("headline") && filled.includes("email") && filled.includes("notes") && !filled.includes("company"), "fill reports what changed");
  const st = Object.fromEntries((await listContacts(db, { q: "lin@example.com" })).map((r: any) => [r.c.id, r.invite]));
  ok(st[r1.id] === "personal", "a quick-added via- contact is a personal introduction, never auto-invited");
  const dup = await saveContact(db, { name: "Lin Dup", email: "LIN@example.com", source: "via-other" }, "", "2026-10-18");
  ok(!dup.created && dup.id === r1.id && (await db.select().from(contacts).where(sql`lower(${contacts.email}) = 'lin@example.com'`)).length === 1, "never a duplicate on the same email");

  // Accelerator submissions become contacts (fill-empty-only, on email). Their notifications go to the stubbed Resend API.
  globalThis.fetch = (async () => new Response("{}", { status: 200 })) as any;
  ok(investorType(null) === "angel" && investorType(" Angel ") === "angel" && investorType("Example Ventures") === "vc", "investor type: Angel when no firm or 'Angel', else VC");
  const before = (await db.select().from(members)).length;
  const founder = parseInterest("founder", fd({ ...founderForm, email: "founder28@example.com", affiliation: "alumni", linkedinUrl: "linkedin.com/in/founder-28", school: "Example School", gradYear: "2018", needs: ["hiring", "investor_intros"] }));
  ok(founder.ok && (founder as any).data.gradYear === 2018 && (founder as any).data.needs.join() === "investor_intros,hiring", "founder: optional LinkedIn, school, grad year and what would help");
  ok(!parseInterest("founder", fd({ ...founderForm, gradYear: "18" })).ok && !parseInterest("founder", fd({ ...founderForm, needs: ["cash"] })).ok && !parseInterest("founder", fd({ ...founderForm, linkedinUrl: "example.com" })).ok, "founder: bad grad year, unknown need or non-LinkedIn URL refused");
  const fId = await receiveInterest(db, (founder as any).data, null, defer);
  await flush();
  const fc = await byEmail("founder28@example.com");
  const [fRow28] = await db.select().from(schema.acceleratorInterest).where(eq(schema.acceleratorInterest.id, fId));
  ok(fc && fc.contactType === "founder" && fc.source === "accelerator-form" && fc.relationship === "replied" && fc.focus.join() === "finance,ai" && fc.nyuAlum === true && fc.company === "Example Labs" && fc.linkedinUrl === "https://www.linkedin.com/in/founder-28" && fRow28.contactId === fc.id && fRow28.school === "Example School", "a founder becomes a Founder contact (accelerator-form, Replied, focus copied) linked from the row");
  await db.update(contacts).set({ relationship: "partner", company: "Kept Name Fund", contactType: "lp" }).where(eq(contacts.id, kn.id));
  const inv = parseInterest("investor", fd({ name: "Known Investor", email: "known@example.com", firm: "New Firm", focus: ["ai"] }));
  const iId = await receiveInterest(db, (inv as any).data, null, defer);
  await flush();
  const kn2 = await byEmail("known@example.com");
  const [iRow] = await db.select().from(schema.acceleratorInterest).where(eq(schema.acceleratorInterest.id, iId));
  ok(kn2.relationship === "partner" && kn2.company === "Kept Name Fund" && kn2.contactType === "lp" && kn2.focus.join() === "finance" && kn2.source === "via-alex-example" && iRow.contactId === kn2.id && iRow.organization === "New Firm", "an investor matching a contact fills nothing filled and never moves a relationship back");
  ok(/Investor list sign-up/.test(kn2.notes) && /Also from investor-list/.test(kn2.notes), "the submission is noted on the contact");
  const ang = parseInterest("investor", fd({ name: "Ang El", email: "angel28@example.com", firm: "Angel", focus: ["blockchain"] }));
  await receiveInterest(db, (ang as any).data, null, defer);
  await flush();
  const ac = await byEmail("angel28@example.com");
  ok(ac.contactType === "angel" && ac.company === null && ac.source === "investor-list" && ac.relationship === "replied", "an angel investor: type Angel, no company");
  ok((await db.select().from(members)).length === before, "accelerator contacts create no members");
  await db.delete(contacts).where(eq(contacts.id, fc.id));
  const [fRow28b] = await db.select().from(schema.acceleratorInterest).where(eq(schema.acceleratorInterest.id, fId));
  ok(fRow28b && fRow28b.contactId === null, "deleting the contact keeps the submission, unlinked");
}

// Round 28.1: form submissions protected from bulk invites, display names, the contact edit page, linked deletes.
{
  const CI = await import(`${P}/lib/contacts-import.ts`);
  const { queueableWhere } = await import(`${P}/lib/invites.ts`);
  const { queueCampaign, processInvites } = await import(`${P}/lib/invite-queue.ts`);
  const { listContacts } = await import(`${P}/lib/contacts-query.ts`);
  const { editContact, parseContactEdit, deleteContactWithLinked, organizerSource } = await import(`${P}/lib/contact-save.ts`);
  const { deleteInterest } = await import(`${P}/lib/accelerator-interest.ts`);
  const { DisplayName, displayNameFor, setDisplayName } = await import(`${P}/lib/admin-profiles.ts`);
  const auditOf = async (action: string) => (await db.select().from(adminAudit)).filter((a: any) => a.action === action);

  ok(CI.protectedKind("via-alex") === "personal" && CI.protectedKind("accelerator-form") === "form" && CI.protectedKind("investor-list") === "form" && CI.protectedKind("luma-2024") === null && CI.protectedKind("investor-list-2") === null, "protected sources: via- and exactly the two form sources");

  const ids = (await db.insert(contacts).values([
    { name: "Form Founder", email: "formf@example.com", source: "accelerator-form" },
    { name: "Form Investor", email: "formi@example.com", source: "investor-list" },
    { name: "Plain Listed", email: "plainl@example.com", source: "fake-r281" },
  ]).returning({ id: contacts.id })).map((x: any) => x.id);
  const [ff, fi, pl] = ids;
  const queueable = async (chosen: string | null = null) => (await db.select({ id: contacts.id }).from(contacts).where(queueableWhere(chosen))).map((x: any) => x.id);
  const all = await queueable();
  ok(all.includes(pl) && !all.includes(ff) && !all.includes(fi), "form submissions are never queueable by default");
  const chosen = await queueable("investor-list");
  ok(chosen.includes(fi) && !chosen.includes(ff), "choosing investor-list includes that form source, not the other");
  ok(!(await queueable("via-alex-example")).includes(fi) && !(await queueable("fake-r281")).includes(ff), "choosing another source never includes form submissions");
  const st = Object.fromEntries((await listContacts(db, {})).map((r: any) => [r.c.id, r.invite]));
  ok(st[ff] === "form" && st[fi] === "form" && st[pl] === "eligible", "invite status: Form submission (not auto-invited)");
  ok((await listContacts(db, { invite: "form" })).every((r: any) => CI.isFormSource(r.c.source)), "Invite filter: form submissions");

  const camp = async (source: string, includePersonal: boolean) =>
    (await db.insert(inviteCampaigns).values({ status: "queued", source, includePersonal, subject: "An invitation", body: "Hi {first_name},\n\nJoin us.", reason: "Test reason.", contentHash: `f-${source}-${includePersonal}`, createdBy: "test" }).returning())[0];
  const notChosen = await camp("investor-list", false);
  ok((await queueCampaign(db, notChosen.id, "investor-list", false)) === 0, "a form source without the explicit choice queues nobody");
  const general = await camp("fake-r281", false);
  ok((await queueCampaign(db, general.id, "fake-r281", false)) === 1, "other sources queue as before");
  await db.insert(schema.inviteQueue).values({ campaignId: general.id, contactId: ff });
  const to: string[] = [];
  globalThis.fetch = (async (_u: string, init: any) => { for (const m of [JSON.parse(init.body)].flat()) to.push(...[m.to].flat()); return new Response("{}", { status: 200 }); }) as any;
  const run = await processInvites(db);
  const [ffRow] = await db.select().from(contacts).where(eq(contacts.id, ff));
  ok(to.includes("plainl@example.com") && !to.includes("formf@example.com") && !ffRow.invitedAt && run.skipped >= 1, "the run skips a form submission in a campaign that didn't include it");
  const explicit = await camp("investor-list", true);
  const queuedN = await queueCampaign(db, explicit.id, "investor-list", true);
  const queuedRows = await db.select({ source: contacts.source, id: contacts.id }).from(schema.inviteQueue).innerJoin(contacts, eq(contacts.id, schema.inviteQueue.contactId)).where(eq(schema.inviteQueue.campaignId, explicit.id));
  ok(queuedN >= 1 && queuedRows.length === queuedN && queuedRows.some((r: any) => r.id === fi) && queuedRows.every((r: any) => r.source === "investor-list"), "explicitly chosen and confirmed: that form source (only) queues");

  // Display names.
  ok(organizerSource("fz.475@example.com", "Fang") === "via-fang" && organizerSource("fz.475@example.com", null) === "via-fz-475" && organizerSource("x@example.com", "  ") === "via-x", "default source: via-<display name>, else the email name");
  ok(DisplayName.safeParse("Fang").success && DisplayName.safeParse("Ana-María O'Neil").success && !DisplayName.safeParse("<b>x</b>").success && !DisplayName.safeParse("x".repeat(41)).success, "display names: letters, spaces, hyphens, apostrophes; 40 at most");
  ok(await setDisplayName(db, "Organizer@Example.com", "Fang", "super@example.com") && (await displayNameFor(db, "organizer@example.com")) === "Fang", "display name saved, keyed by lowercase email");
  ok(!(await setDisplayName(db, "organizer@example.com", "Fang", "super@example.com")), "saving the same name is a no-op");
  ok(await setDisplayName(db, "organizer@example.com", "", "super@example.com") && (await displayNameFor(db, "organizer@example.com")) === null, "an empty name clears it");
  const dn = await auditOf("team.display_name");
  ok(dn.length === 2 && dn[0].changes.displayName.join() === ",Fang" && dn[1].changes.displayName[0] === "Fang" && dn[1].changes.displayName[1] === null, "display name changes logged old → new");

  // The edit page: any direction, every change logged old → new, notes appended.
  await db.update(contacts).set({ relationship: "partner", contactType: "vc", focus: ["ai"], company: "Old Co" }).where(eq(contacts.id, fi));
  const form = (o: Record<string, string | string[]>) => parseContactEdit(fd({ company: "Old Co", headline: "", linkedinUrl: "", contactType: "vc", focus: ["ai"], stage: "", nyuAlum: "", relationship: "partner", note: "", ...o }));
  ok(!form({ linkedinUrl: "example.com/x" }).ok && !form({ relationship: "friends" }).ok, "edit refuses a non-LinkedIn URL and an unknown relationship");
  const e1 = await editContact(db, fi, (form({ relationship: "cold", contactType: "angel", focus: ["ai", "finance"], company: "", linkedinUrl: "linkedin.com/in/form-i", nyuAlum: "no", note: "Called back" }) as any).data, "admin@example.com", "2026-10-18");
  const [fiRow] = await db.select().from(contacts).where(eq(contacts.id, fi));
  ok(fiRow.relationship === "cold" && fiRow.contactType === "angel" && fiRow.focus.join() === "finance,ai" && fiRow.company === null && fiRow.linkedinUrl === "https://www.linkedin.com/in/form-i" && fiRow.nyuAlum === false, "an organizer edit can move the relationship back and clear fields");
  ok(fiRow.notes === "2026-10-18: Called back" && fiRow.lastTouchAt === "2026-10-18", "the note is a dated line and moves the last touch");
  ok(e1.relationship.join() === "partner,cold" && e1.contactType.join() === "vc,angel" && e1.company[0] === "Old Co" && e1.company[1] === null && e1.note[1] === "added", "changes come back old → new");
  const ed = await auditOf("contact.edit");
  ok(ed.length === 1 && ed[0].actor === "admin@example.com" && ed[0].changes.relationship.join() === "partner,cold" && !JSON.stringify(ed[0]).includes("Called back"), "contact.edit logged with old → new, never the note's text");
  const e2 = await editContact(db, fi, (form({ relationship: "cold", contactType: "angel", focus: ["finance", "ai"], company: "", linkedinUrl: "https://www.linkedin.com/in/form-i", nyuAlum: "no" }) as any).data, "admin@example.com", "2026-10-18");
  ok(Object.keys(e2).length === 0 && (await auditOf("contact.edit")).length === 1, "saving without changes logs nothing");
  ok((await editContact(db, 999999, (form({}) as any).data, "admin@example.com")) === null, "a missing contact is reported");

  // Linked deletes: a contact with its accelerator rows, or a row with its contact; logged without content.
  const [r1] = await db.insert(schema.acceleratorInterest).values({ type: "investor", name: "Form Investor", email: "formi@example.com", focus: ["ai"], contactId: fi }).returning();
  const [r2] = await db.insert(schema.acceleratorInterest).values({ type: "founder", name: "Form Founder", email: "formf@example.com", focus: ["ai"], contactId: ff }).returning();
  const [r3] = await db.insert(schema.acceleratorInterest).values({ type: "investor", name: "Keep Me", email: "keep@example.com", focus: ["ai"], contactId: pl }).returning();
  ok((await deleteContactWithLinked(db, fi, "super@example.com", true))!.accelerator.join() === String(r1.id), "deleting a contact can also delete its linked accelerator rows");
  ok((await db.select().from(schema.acceleratorInterest).where(eq(schema.acceleratorInterest.id, r1.id))).length === 0, "the linked row is gone");
  ok(await deleteInterest(db, r2.id, "super@example.com", true) && (await db.select().from(contacts).where(eq(contacts.id, ff))).length === 0, "deleting an accelerator row can also delete its contact");
  await deleteContactWithLinked(db, pl, "super@example.com", false);
  const [r3b] = await db.select().from(schema.acceleratorInterest).where(eq(schema.acceleratorInterest.id, r3.id));
  ok(r3b && r3b.contactId === null, "without the tick, the other record stays (unlinked)");
  const dels = (await db.select().from(adminAudit)).filter((a: any) => (a.action === "contact.delete" || a.action === "accelerator.delete") && /linked/.test(a.detail));
  ok(dels.length === 4 && dels.every((a: any) => !/example\.com|Form |Keep Me/.test(a.detail)), "linked deletes logged for each record, without content");
}
await pg.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall database checks passed");
