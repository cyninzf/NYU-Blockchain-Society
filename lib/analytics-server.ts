import "server-only";
import { track } from "@vercel/analytics/server";
import { headers } from "next/headers";
import { after } from "next/server";

/**
 * A Vercel Web Analytics custom event from the server (round 16), for things only the server
 * knows happened (a real check-in). Never personal data. Sent after the response; only on Vercel.
 */
export async function trackServer(name: "checkin_completed", props: { event: string }) {
  if (!process.env.VERCEL) return;
  const h = await headers();
  after(() => track(name, props, { headers: h }).catch(() => {}));
}
