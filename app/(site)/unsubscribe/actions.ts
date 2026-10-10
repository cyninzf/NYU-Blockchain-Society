"use server";

import { getDb } from "@/lib/db";
import { applyUnsubscribe, unsubscribeTarget } from "@/lib/unsubscribe";

export type UnsubState = { done: "unsubscribed" | "resubscribed" } | { error: string } | null;

/**
 * No login: the signed link is the proof. A member's link stops every email to that member (and
 * can be undone); a contact's link from an invite stops invites to that address for good.
 */
export async function changeSubscription(_prev: UnsubState, fd: FormData): Promise<UnsubState> {
  const target = unsubscribeTarget(String(fd.get("t") ?? ""));
  if (!target) return { error: "This unsubscribe link isn't valid. Use the link from your most recent email." };
  const db = getDb();
  if (!db) return { error: "Something went wrong on our side. Please try again in a moment." };
  const on = target.kind === "contact" || fd.get("action") !== "resubscribe";
  if (!(await applyUnsubscribe(db, target, on))) return { error: "We couldn't find that address. It may have been removed." };
  return { done: on ? "unsubscribed" : "resubscribed" };
}
