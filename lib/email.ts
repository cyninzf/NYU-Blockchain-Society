import "server-only";
import { gt, sql } from "drizzle-orm";
import type { Db } from "./db";
import { emailLog } from "./db/schema";
import { undeliverable } from "./invites";

// All email goes through Resend's HTTP API (no SDK). RESEND_API_KEY and REPLY_TO_EMAIL come from
// the environment and are never logged. Without a key (local Codespaces) nothing is sent.

export const FROM = "NYU Blockchain Society <hello@nyublockchainsociety.com>";
/** Resend's free plan allows 100 emails a day; override with EMAIL_DAILY_LIMIT on a paid plan. */
export const DAILY_EMAIL_LIMIT = Number(process.env.EMAIL_DAILY_LIMIT) || 100;
/** Resend's batch endpoint takes at most 100 emails per request. */
const BATCH_MAX = 100;

export type EmailKind = "welcome" | "admin-link" | "member-link" | "checkin-link" | "announcement" | "announcement-test" | "invite" | "invite-test";
export type Message = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> };
export type SendResult = { ok: true; sent: number } | { ok: false; error: string };

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

/** Emails sent in the last 24 hours (rolling, which is never more generous than a calendar day). */
export async function sentLast24h(db: Db): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`coalesce(sum(${emailLog.recipients}), 0)::int` }).from(emailLog)
    .where(gt(emailLog.createdAt, sql`now() - interval '24 hours'`));
  return n;
}
export const remainingToday = async (db: Db) => Math.max(0, DAILY_EMAIL_LIMIT - (await sentLast24h(db)));

const payload = (m: Message) => ({
  from: FROM,
  to: [m.to],
  subject: m.subject,
  html: m.html,
  text: m.text,
  ...(process.env.REPLY_TO_EMAIL ? { reply_to: process.env.REPLY_TO_EMAIL } : {}),
  ...(m.headers ? { headers: m.headers } : {}),
});

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true, status: res.status };
  // Resend's error body names the problem (never the key); keep it short for logs.
  const err = await res.json().catch(() => null) as { message?: string } | null;
  return { ok: false, status: res.status, error: err?.message?.slice(0, 200) ?? `HTTP ${res.status}` };
}

/** One email (sign-in links, welcome, tests). Counted toward the daily limit. */
export async function sendEmail(db: Db, kind: EmailKind, m: Message): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, error: "Email isn't set up for this environment (RESEND_API_KEY)." };
  if ((await remainingToday(db)) < 1) return { ok: false, error: "Today's email limit is used up. Try again tomorrow." };
  // Hard bounces and spam complaints (Resend's webhook, lib/invites.ts) never get another email.
  if ((await undeliverable(db, [m.to])).size) return { ok: false, error: "That address bounced or reported spam before, so it gets no email." };
  const r = await post("/emails", payload(m));
  if (!r.ok) { console.error(`email ${kind} failed`, r.status, r.error); return { ok: false, error: "The email service refused the message." }; }
  await db.insert(emailLog).values({ kind, recipients: 1 });
  return { ok: true, sent: 1 };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Many emails, one per recipient (each carries its own unsubscribe link), in batches of 100,
 * spaced out to stay under Resend's request rate. The caller checks the daily limit first.
 * Stops at the first failed batch and reports how many went out.
 */
export async function sendBatch(db: Db, kind: EmailKind, all: Message[]): Promise<SendResult & { sent: number; skipped: number }> {
  if (!emailConfigured()) return { ok: false, error: "Email isn't set up for this environment (RESEND_API_KEY).", sent: 0, skipped: 0 };
  // Hard bounces and spam complaints never get another email: left out, and counted as skipped.
  const blocked = await undeliverable(db, all.map((m) => m.to));
  const messages = all.filter((m) => !blocked.has(m.to.trim().toLowerCase()));
  const skipped = all.length - messages.length;
  let sent = 0;
  for (let i = 0; i < messages.length; i += BATCH_MAX) {
    const chunk = messages.slice(i, i + BATCH_MAX);
    if (i) await wait(600);
    const r = await post("/emails/batch", chunk.map(payload));
    if (!r.ok) {
      console.error(`email batch ${kind} failed`, r.status, r.error);
      return { ok: false, error: `The email service refused a batch after ${sent} sent.`, sent, skipped };
    }
    await db.insert(emailLog).values({ kind, recipients: chunk.length });
    sent += chunk.length;
  }
  return { ok: true, sent, skipped };
}

// --- Templates: plain, on-brand HTML plus a text version ---

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type EmailContent = {
  /** Shown above the heading, e.g. "Block #42". */
  kicker?: string;
  heading: string;
  /** Plain-text paragraphs (escaped; blank-line separated text from admins arrives here). */
  paragraphs: string[];
  cta?: { label: string; href: string };
  /** Small print under a rule, e.g. why they got it. */
  note?: string;
  unsubscribeUrl?: string;
  /** The society's postal address (Settings), in the footer of invites and announcements. */
  postalAddress?: string | null;
};

/** Violet-night header, white card, Geist-like system type. Inline styles only (email clients). */
export function renderEmail(c: EmailContent): { html: string; text: string } {
  const font = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`; // single quotes: it goes inside style=""
  const mono = `ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;
  const p = (t: string) => `<p style="margin:0 0 16px;font:16px/1.55 ${font};color:#2A1A3C">${esc(t).replace(/\n/g, "<br>")}</p>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.heading)}</title></head>
<body style="margin:0;padding:0;background:#F5F1F9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1F9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:#1C0533;background-image:linear-gradient(135deg,#1C0533,#3A0A63);border-radius:12px 12px 0 0;padding:20px 28px;font:600 15px/1.2 ${font};color:#F5EEFB;letter-spacing:-.01em">NYU Blockchain Society</td></tr>
<tr><td style="background:#FFFFFF;border-radius:0 0 12px 12px;padding:28px 28px 24px">
${c.kicker ? `<p style="margin:0 0 8px;font:500 12px/1.3 ${mono};letter-spacing:.08em;text-transform:uppercase;color:#57068C">${esc(c.kicker)}</p>` : ""}
<h1 style="margin:0 0 18px;font:600 24px/1.2 ${font};letter-spacing:-.02em;color:#120A1C">${esc(c.heading)}</h1>
${c.paragraphs.map(p).join("\n")}
${c.cta ? `<p style="margin:8px 0 20px"><a href="${esc(c.cta.href)}" style="display:inline-block;background:#57068C;color:#FFFFFF;text-decoration:none;font:600 15px/1 ${font};padding:14px 20px;border-radius:8px">${esc(c.cta.label)}</a></p>` : ""}
${c.note || c.unsubscribeUrl ? `<hr style="border:0;border-top:1px solid #DED2EA;margin:8px 0 14px">` : ""}
${c.note ? `<p style="margin:0 0 8px;font:13px/1.5 ${font};color:#5C4C6C">${esc(c.note)}</p>` : ""}
${c.unsubscribeUrl ? `<p style="margin:0;font:13px/1.5 ${font};color:#5C4C6C"><a href="${esc(c.unsubscribeUrl)}" style="color:#57068C">Unsubscribe</a> from NYU Blockchain Society emails.</p>` : ""}
</td></tr>
<tr><td style="padding:14px 28px;font:12px/1.5 ${font};color:#5C4C6C;text-align:center">NYU Blockchain Society · Official NYU Alumni Club · Based in New York${c.postalAddress ? `<br>${esc(c.postalAddress).replace(/\n/g, "<br>")}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    c.kicker, c.heading, "", ...c.paragraphs.flatMap((t) => [t, ""]),
    c.cta ? `${c.cta.label}: ${c.cta.href}\n` : "",
    c.note ?? "",
    c.unsubscribeUrl ? `Unsubscribe: ${c.unsubscribeUrl}` : "",
    "", "NYU Blockchain Society · Official NYU Alumni Club · Based in New York",
    c.postalAddress ?? "",
  ].filter((l) => l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { html, text };
}
