"use server";

import { getDb } from "@/lib/db";
import { memberFromUnsubscribeToken, setUnsubscribed } from "@/lib/member-email";

export type UnsubState = { done: "unsubscribed" | "resubscribed" } | { error: string } | null;

/** No login: the signed link is the proof. Unsubscribing stops every email to that member. */
export async function changeSubscription(_prev: UnsubState, fd: FormData): Promise<UnsubState> {
  const id = memberFromUnsubscribeToken(String(fd.get("t") ?? ""));
  if (!id) return { error: "This unsubscribe link isn't valid. Use the link from your most recent email." };
  const db = getDb();
  if (!db) return { error: "Something went wrong on our side. Please try again in a moment." };
  const on = fd.get("action") !== "resubscribe";
  if (!(await setUnsubscribed(db, id, on))) return { error: "We couldn't find that membership. It may have been removed." };
  return { done: on ? "unsubscribed" : "resubscribed" };
}
