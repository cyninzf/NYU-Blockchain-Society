/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
// npm run test:sentry — runs fake errors through Sentry's real event pipeline (the SDK's own
// linked-errors handling builds the exception chain) and our beforeSend scrubber, with no DSN
// and no network. Checks that query parameters, emails and tokens never survive (round 18).
import * as Sentry from "@sentry/node";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { fileURLToPath } from "node:url";

const P = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const { scrubEvent } = await import(`${P}/lib/sentry-options.ts`);

let failed = 0;
const ok = (cond: unknown, msg: string) => { if (!cond) { failed++; console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg); };

const sent: any[] = [];
Sentry.init({
  dsn: "https://public@o0.ingest.sentry.io/0", // never contacted: beforeSend drops every event
  sendDefaultPii: false,
  tracesSampleRate: 0,
  defaultIntegrations: false,
  integrations: [Sentry.linkedErrorsIntegration()],
  beforeSend: (event: any) => { sent.push(scrubEvent(event)); return null; },
});

const EMAIL = "fay.founder@example.com";
const TOKEN = "Zm9vYmFyLXRva2VuLWhhc2gtZm9yLXRlc3RzLW9ubHk";
const SQL = 'select "subject" from "auth_sessions" where ("auth_sessions"."token_hash" = $1 and "auth_sessions"."kind" = $2)';

// Like issue NYU-BLOCKCHAIN-SOCIETY-1: a Drizzle "Failed query" wrapping a Neon connection error.
const neon = Object.assign(new Error(`Error connecting to database: fetch failed for ${EMAIL}`), { name: "NeonDbError" });
const drizzle = new DrizzleQueryError(SQL, [TOKEN, "admin", EMAIL], neon);
// And one more level, as when our code wraps it.
const outer = new Error("session lookup failed", { cause: drizzle });

Sentry.captureException(outer);
Sentry.captureMessage(`Failed query: ${SQL}\nparams: ${TOKEN},${EMAIL}`);
await Sentry.flush(1000);

ok(sent.length === 2, "both events went through beforeSend");
const ev = sent[0];
const values: string[] = (ev.exception?.values ?? []).map((v: any) => v.value ?? "");
ok(values.length === 3, `the whole chain is there (${values.length} exceptions)`);
ok(values.some((v) => v.startsWith("Failed query: select") && v.includes('"token_hash" = $1')), "the SQL text itself is kept");
for (const [i, e] of sent.entries()) {
  const all = JSON.stringify(e);
  ok(!all.includes(TOKEN), `event ${i + 1}: no token anywhere`);
  ok(!all.includes(EMAIL) && !/@example\.com/.test(all), `event ${i + 1}: no email anywhere`);
  ok(!/params:\s*\S/i.test(all.replace(/\[params removed\]/g, "")), `event ${i + 1}: no params values`);
}
ok(sent[1].message?.startsWith("Failed query: select") && sent[1].message.includes("[params removed]"), "captured message keeps the SQL, drops params");

console.log(failed ? `\n${failed} check(s) failed` : "\nall Sentry scrubbing checks passed");
