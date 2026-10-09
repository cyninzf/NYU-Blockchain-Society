"use server";

import { eq } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { members } from "@/lib/db/schema";

const idOf = (fd: FormData) => {
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id < 1) throw new Error("Bad id");
  return id;
};

export async function setWallApproved(fd: FormData) {
  const db = await requireAdmin();
  await db.update(members).set({ wallApproved: fd.get("approved") === "1" }).where(eq(members.id, idOf(fd)));
  updateTag("wall");
  refresh();
}

/** For removal requests. Permanent. */
export async function deleteMember(fd: FormData) {
  const db = await requireAdmin();
  if (fd.get("confirm") !== "yes") throw new Error("Not confirmed");
  await db.delete(members).where(eq(members.id, idOf(fd)));
  updateTag("wall");
  refresh();
}
