"use server";

import { refresh } from "next/cache";
import { setInterestStatus } from "@/lib/accelerator-interest";
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
