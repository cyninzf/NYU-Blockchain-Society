"use server";

import { refresh } from "next/cache";
import { deleteInterest, setInterestStatus, markInterestNotSpam } from "@/lib/accelerator-interest";
import { requireSuperOr403 } from "@/lib/admin";
import { INTEREST_STATUSES, type InterestStatus } from "@/lib/db/schema";

/** Super admins only (admins read); every change is in the audit log. */
export async function changeInterestStatus(fd: FormData) {
  const id = Number(fd.get("id")), status = String(fd.get("status")) as InterestStatus;
  const { db, actor } = await requireSuperOr403(`change the status of accelerator interest #${id}`);
  if (!Number.isInteger(id) || id < 1 || !INTEREST_STATUSES.includes(status)) throw new Error("Bad request");
  await setInterestStatus(db, id, status, actor);
  refresh();
}

/** For removal requests (round 17): super admins only, after the confirm step; logged without content. */
export async function removeInterest(fd: FormData) {
  const id = Number(fd.get("id"));
  const { db, actor } = await requireSuperOr403(`delete accelerator interest #${id}`);
  if (!Number.isInteger(id) || id < 1 || fd.get("confirm") !== "yes") throw new Error("Bad request");
  await deleteInterest(db, id, actor);
  refresh();
}

/** Suspected spam → normal (round 20): super admins only; sends the email it skipped, once. Logged without content. */
export async function notSpamInterest(fd: FormData) {
  const id = Number(fd.get("id"));
  const { db, actor } = await requireSuperOr403(`mark #${id} not spam`);
  if (!Number.isInteger(id) || id < 1) throw new Error("Bad request");
  await markInterestNotSpam(db, id, actor);
  refresh();
}
