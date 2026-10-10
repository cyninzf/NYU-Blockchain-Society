"use server";

import * as Sentry from "@sentry/nextjs";
import { audit, requireSuperOr403 } from "@/lib/admin";

export type TestResult = { ok: boolean; message: string } | null;

/** Super admins only: one tagged server-side test error, flushed before the response. */
export async function sendServerTestError(): Promise<TestResult> {
  const { db, actor } = await requireSuperOr403("send a Sentry test error");
  if (!process.env.SENTRY_DSN) return { ok: false, message: "Sentry is off on the server: SENTRY_DSN isn't set for this environment." };
  const id = Sentry.captureException(new Error("Sentry test error (server) from /admin/sentry-test"), { tags: { area: "admin", test: "yes" } });
  const flushed = await Sentry.flush(3000);
  await audit(db, actor, "sentry.test", `Sent a Sentry test error (server, event ${id})`);
  return flushed ? { ok: true, message: `Sent. Look for event ${id} in Sentry (tags area:admin, test:yes).` } : { ok: false, message: "Captured, but Sentry didn't confirm in 3 seconds. Check the DSN." };
}
