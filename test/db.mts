/* eslint-disable @typescript-eslint/no-explicit-any -- the PGlite database stands in for the app's Neon-typed Db */
// npm run test:db — applies every migration in drizzle/ to an in-memory Postgres (PGlite) and
// exercises the app's real database code with obviously fake data (example.com). No network,
// no DATABASE_URL, nothing written anywhere. Run it before every commit that touches the database.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
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
// Round 14: accelerator interest (founders and supporters).
const { parseInterest, saveInterest, founderAsMember } = await import(`${P}/lib/accelerator-interest.ts`);
const fd = (o: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x); return f; };
const founderForm = { name: "Fay Founder", email: "fay@example.com", affiliation: "other", company: "Example Labs", oneLiner: "Test company for the database check.", stage: "building", focus: ["ai", "finance", "ai"], url: "example.com" };
const pf = parseInterest("founder", fd(founderForm));
ok(pf.ok && pf.data.website === "https://example.com" && pf.data.focus.length === 2 && pf.data.addMember === false, "founder parsed: website gets https, focus deduped, no member by default");
ok(!parseInterest("founder", fd({ ...founderForm, focus: [] })).ok, "founder needs at least one focus");
ok(!parseInterest("founder", fd({ ...founderForm, stage: "series-z" })).ok, "unknown stage refused");
ok(!parseInterest("founder", fd({ ...founderForm, url: "not a site" })).ok, "bad website refused");
const ps = parseInterest("supporter", fd({ name: "Sid Supporter", email: "sid@example.com", organization: "Example Fund", help: ["mentor", "invest"], message: "" }));
ok(ps.ok && ps.data.message === null && ps.data.help.join() === "mentor,invest", "supporter parsed, blank message is null");
ok(!parseInterest("supporter", fd({ name: "Sid", email: "sid@example.com", organization: "X", help: ["lend"] })).ok, "unknown help kind refused");
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
ok((await listInterest(db, flt)).length === 1 && (await listInterest(db, { focus: "blockchain" })).length === 0, "focus filter matches founders' focus");
ok((await listInterest(db, { type: "supporter", status: "new" })).length === 1, "type and status filters");
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
ok(await verifyContactMessage(db, tok), "confirmation link verifies the request");
const [cv] = await db.select().from(schema.contactMessages).where(eq(schema.contactMessages.id, cid));
ok(cv.verifiedAt instanceof Date, "request marked verified");
ok(!(await verifyContactMessage(db, tok)), "the link works only once");
const old = await createLinkToken(db, "contact", String(cid), -1000);
ok(!(await verifyContactMessage(db, old)), "an expired link is refused");
ok(!(await verifyContactMessage(db, "not-a-real-token-at-all-xxxxxxxxxx")), "an unknown link is refused");
const memberTok = await createLinkToken(db, "member", String(cid));
ok(!(await verifyContactMessage(db, memberTok)), "a link of another purpose can't verify a request");
const { setContactStatus, deleteContactMessage } = await import(`${P}/lib/contact-messages.ts`);
ok(await setContactStatus(db, cid, "replied", "super@example.com"), "contact message status changed");
const cAudit = (await db.select().from(adminAudit)).filter((a: any) => a.action === "contact_message.status");
ok(cAudit.length === 1 && cAudit[0].changes.status.join() === "new,replied", "contact status change logged with old and new");
ok(await deleteContactMessage(db, cid, "super@example.com"), "contact message deleted");
ok(!(await deleteContactMessage(db, cid, "super@example.com")), "deleting it again is a no-op");
const cDel = (await db.select().from(adminAudit)).filter((a: any) => a.action === "contact_message.delete");
ok(cDel.length === 1 && cDel[0].actor === "super@example.com" && cDel[0].detail === `Deleted contact message #${cid}` && Object.keys(cDel[0].changes ?? {}).length === 0, "contact delete logged with who, when and which, no content");
// Round 20: the shared bot guard. A real person filling a form normally is always kept.
const { formGuard, MIN_FILL_MS } = await import(`${P}/lib/form-guard.ts`);
const { sign } = await import(`${P}/lib/security.ts`);
const { HONEYPOT_FIELD } = await import(`${P}/lib/honeypot.ts`);
const tokenAt = (msAgo: number) => sign(`f.${Date.now() - msAgo}`);
const warn = console.warn; const drops: string[] = []; console.warn = (m: string) => drops.push(m);
const kind = (g: any) => (g.kind === "ok" ? `ok:${g.spam ?? "clean"}` : g.kind);
ok(kind(formGuard("contact", tokenAt(MIN_FILL_MS + 500), "")) === "ok:clean", "a normal submit after a few seconds is kept");
ok(kind(formGuard("contact", tokenAt(60_000), "")) === "ok:clean", "a slow submit is kept");
ok(kind(formGuard("contact", tokenAt(300), "")) === "ok:too_fast", "an instant submit is kept, flagged");
ok(kind(formGuard("inquiry", tokenAt(10_000), "http://spam.example")) === "ok:honeypot", "a filled honeypot is kept, flagged");
ok(kind(formGuard("contact", tokenAt(25 * 3600e3), "")) === "expired" && kind(formGuard("contact", "forged.token", "")) === "expired", "an old or forged token is refused");
console.warn = warn;
ok(drops.join("|") === "contact flagged: too_fast|inquiry flagged: honeypot", "each flag is logged as \"<form> flagged: <reason>\" only");
ok(MIN_FILL_MS <= 2000 && !/web|site|url|mail|name|phone|tel|mobile|hp|company|org|addr|city|zip|post|country|card/i.test(HONEYPOT_FIELD), "the honeypot name matches none of Chrome's autofill words (hp = phone) and the minimum time is 2 s at most");
await pg.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall database checks passed");
