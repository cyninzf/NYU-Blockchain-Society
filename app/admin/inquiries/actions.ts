"use server";

import { refresh } from "next/cache";
import { requireSuperOr403 } from "@/lib/admin";
import { INQUIRY_STATUSES, type InquiryStatus } from "@/lib/db/schema";
import { deleteInquiry, setInquiryStatus, markInquiryNotSpam } from "@/lib/inquiries";

/** Super admins only (admins read); every change is in the audit log. */
export async function changeInquiryStatus(fd: FormData) {
  const id = Number(fd.get("id")), status = String(fd.get("status")) as InquiryStatus;
  const { db, actor } = await requireSuperOr403(`change the status of inquiry #${id}`);
  if (!Number.isInteger(id) || id < 1 || !INQUIRY_STATUSES.includes(status)) throw new Error("Bad request");
  await setInquiryStatus(db, id, status, actor);
  refresh();
}

/** For removal requests (round 17): super admins only, after the confirm step; logged without content. */
export async function removeInquiry(fd: FormData) {
  const id = Number(fd.get("id"));
  const { db, actor } = await requireSuperOr403(`delete inquiry #${id}`);
  if (!Number.isInteger(id) || id < 1 || fd.get("confirm") !== "yes") throw new Error("Bad request");
  await deleteInquiry(db, id, actor);
  refresh();
}

/** Suspected spam → normal (round 20): super admins only; sends the email it skipped, once. Logged without content. */
export async function notSpamInquiry(fd: FormData) {
  const id = Number(fd.get("id"));
  const { db, actor } = await requireSuperOr403(`mark #${id} not spam`);
  if (!Number.isInteger(id) || id < 1) throw new Error("Bad request");
  await markInquiryNotSpam(db, id, actor);
  refresh();
}
