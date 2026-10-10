"use server";

import { refresh } from "next/cache";
import { requireSuperOr403 } from "@/lib/admin";
import { INQUIRY_STATUSES, type InquiryStatus } from "@/lib/db/schema";
import { setInquiryStatus } from "@/lib/inquiries";

/** Super admins only (admins read); every change is in the audit log. */
export async function changeInquiryStatus(fd: FormData) {
  const id = Number(fd.get("id")), status = String(fd.get("status")) as InquiryStatus;
  const { db, actor } = await requireSuperOr403(`change the status of inquiry #${id}`);
  if (!Number.isInteger(id) || id < 1 || !INQUIRY_STATUSES.includes(status)) throw new Error("Bad request");
  await setInquiryStatus(db, id, status, actor);
  refresh();
}
