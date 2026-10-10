"use server";

import { refresh } from "next/cache";
import { requireSuperOr403 } from "@/lib/admin";
import { deleteContactMessage, setContactStatus } from "@/lib/contact-messages";
import { CONTACT_STATUSES, type ContactStatus } from "@/lib/db/schema";

/** Super admins only (admins read); every change is in the audit log. */
export async function changeContactStatus(fd: FormData) {
  const id = Number(fd.get("id")), status = String(fd.get("status")) as ContactStatus;
  const { db, actor } = await requireSuperOr403(`change the status of contact message #${id}`);
  if (!Number.isInteger(id) || id < 1 || !CONTACT_STATUSES.includes(status)) throw new Error("Bad request");
  await setContactStatus(db, id, status, actor);
  refresh();
}

/** For removal requests: super admins only, after the confirm step; logged without content. */
export async function removeContactMessage(fd: FormData) {
  const id = Number(fd.get("id"));
  const { db, actor } = await requireSuperOr403(`delete contact message #${id}`);
  if (!Number.isInteger(id) || id < 1 || fd.get("confirm") !== "yes") throw new Error("Bad request");
  await deleteContactMessage(db, id, actor);
  refresh();
}
