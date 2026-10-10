"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { audit, auditRow, requireSuperOr403 } from "@/lib/admin";
import { baseUrl } from "@/lib/base-url";
import { recordCheckin } from "@/lib/checkin";
import { createDisplayLink } from "@/lib/display-links";
import { adminAudit, displayLinks, events, type AuditChanges, type EventRow, type EventStatus } from "@/lib/db/schema";
import { EventInput, type EventFields } from "@/lib/event-fields";
import { dateToNyInput } from "@/lib/event-time";

// Events: super admins only (round 10.2). Admins can view /admin/events and the preview, but
// every action here refuses them with a 403 and logs the attempt. Every change is logged in
// admin_audit, and the public pages (cached under "events") refresh at once.

export type EventFormResult = { ok: true; message: string } | { ok: false; error: string } | null;

const idOf = (v: FormDataEntryValue | null) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };

/** How a value reads in the audit log: times in New York, blanks as null. */
const shown = (v: string | Date | null) => (v === null ? null : v instanceof Date ? `${dateToNyInput(v).replace("T", " ")} ET` : v);
const FIELDS: [keyof EventFields, string][] = [
  ["title", "title"], ["kind", "label"], ["slug", "link name"], ["startsAt", "starts"], ["endsAt", "ends"], ["venueName", "venue"],
  ["address", "address"], ["description", "description"], ["registrationUrl", "registration link"], ["cohost", "co-host"],
];

const isUnique = (e: unknown) => {
  const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  return [err?.code, err?.cause?.code].includes("23505") || /unique/i.test(`${err?.message} ${err?.cause?.message}`);
};

/** Create (as a draft) or edit. Editing never changes the status. */
export async function saveEvent(_prev: EventFormResult, fd: FormData): Promise<EventFormResult> {
  const id = idOf(fd.get("id"));
  const { db, actor } = await requireSuperOr403(id ? `edit event #${id}` : "create an event");
  const parsed = EventInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const d = parsed.data;

  if (!id) {
    let created: number;
    try {
      const [row] = await db.insert(events).values({ ...d, status: "draft", createdBy: actor }).returning({ id: events.id });
      created = row.id;
    } catch (e) {
      if (isUnique(e)) return { ok: false, error: `Another event already uses the link name "${d.slug}". Pick another.` };
      console.error("event create failed", e instanceof Error ? e.message : e);
      return { ok: false, error: "The database refused the event. Nothing was saved." };
    }
    await audit(db, actor, "event.create", `Created event #${created} "${d.title}" (draft)`);
    updateTag("events");
    redirect(`/admin/events/${created}?created=1`);
  }

  const [old] = await db.select().from(events).where(eq(events.id, id));
  if (!old) return { ok: false, error: `Event #${id} no longer exists.` };
  const changes: AuditChanges = {};
  for (const [k, label] of FIELDS) {
    const from = shown(old[k as keyof EventRow] as string | Date | null), to = shown(d[k]);
    if (from !== to) changes[label] = [from, to];
  }
  if (!Object.keys(changes).length) return { ok: true, message: "No changes." };
  try {
    await db.batch([
      db.update(events).set({ ...d, updatedAt: new Date() }).where(eq(events.id, id)),
      db.insert(adminAudit).values(auditRow(actor, "event.edit", `Edited event #${id} "${d.title}"`, { changes })),
    ]);
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: `Another event already uses the link name "${d.slug}". Nothing was saved.` };
    console.error("event edit failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The database refused the change. Nothing was saved." };
  }
  updateTag("events");
  refresh();
  return { ok: true, message: old.status === "published" && changes["link name"] ? "Saved. The link name changed, so the old event link and share link no longer work." : "Saved." };
}

// Which status changes are allowed, and how each is logged. A draft is never cancelled (that
// would make it public), and a cancelled event can be published again.
const MOVES: Record<string, { from: EventStatus[]; action: string; verb: string }> = {
  published: { from: ["draft", "cancelled"], action: "event.publish", verb: "Published" },
  cancelled: { from: ["published"], action: "event.cancel", verb: "Cancelled" },
  draft: { from: ["published"], action: "event.unpublish", verb: "Moved back to draft" },
};

export async function setEventStatus(fd: FormData) {
  const id = idOf(fd.get("id")), to = String(fd.get("to"));
  const { db, actor } = await requireSuperOr403(`${MOVES[to]?.action ?? "change the status of"} event #${id}`);
  const move = MOVES[to];
  if (!id || !move) throw new Error("Bad request");
  const [e] = await db.select({ status: events.status, title: events.title }).from(events).where(eq(events.id, id));
  if (!e || !move.from.includes(e.status)) throw new Error("That change isn't possible from the event's current status.");
  await db.batch([
    db.update(events).set({ status: to as EventStatus, updatedAt: new Date() }).where(eq(events.id, id)),
    db.insert(adminAudit).values(auditRow(actor, move.action, `${move.verb} event #${id} "${e.title}"`, { changes: { status: [e.status, to] } })),
  ]);
  updateTag("events");
  refresh();
}

/** Permanent. */
export async function deleteEvent(fd: FormData) {
  const id = idOf(fd.get("id"));
  const { db, actor } = await requireSuperOr403(`delete event #${id}`);
  if (!id || fd.get("confirm") !== "yes") throw new Error("Bad request");
  const [gone] = await db.delete(events).where(eq(events.id, id)).returning({ title: events.title, status: events.status });
  if (gone) await audit(db, actor, "event.delete", `Deleted event #${id} "${gone.title}" (${gone.status})`);
  updateTag("events");
  if (fd.get("from") === "edit") redirect("/admin/events");
  refresh();
}

/** "Check in a member" by hand at the door (super admins). Logged with the admin as actor. */
export async function adminCheckIn(fd: FormData) {
  const id = idOf(fd.get("id")), memberId = idOf(fd.get("memberId"));
  const { db, actor } = await requireSuperOr403(`check in member #${memberId} at event #${id}`);
  if (!id || !memberId) throw new Error("Bad request");
  const [e] = await db.select({ id: events.id }).from(events).where(eq(events.id, id));
  if (!e) throw new Error(`No event #${id}.`);
  await recordCheckin(db, id, memberId, "admin", actor);
  refresh();
}

export type DisplayLinkResult = { ok: true; url: string } | { ok: false; error: string } | null;

/** A signed live-screen URL for a TV, shown once (only its hash is stored). Published events only. */
export async function makeDisplayLink(_prev: DisplayLinkResult, fd: FormData): Promise<DisplayLinkResult> {
  const id = idOf(fd.get("id"));
  const { db, actor } = await requireSuperOr403(`create a display link for event #${id}`);
  const [e] = await db.select({ slug: events.slug, status: events.status }).from(events).where(eq(events.id, id));
  if (!e) return { ok: false, error: `No event #${id}.` };
  if (e.status !== "published") return { ok: false, error: "Publish the event first: display links only work for published events." };
  const link = await createDisplayLink(db, id, actor);
  await audit(db, actor, "event.display_link.create", `Created display link #${link.id} for event #${id}`);
  refresh();
  return { ok: true, url: `${baseUrl()}/events/${e.slug}/live?d=${link.token}` };
}

export async function revokeDisplayLink(fd: FormData) {
  const id = idOf(fd.get("id")), linkId = idOf(fd.get("linkId"));
  const { db, actor } = await requireSuperOr403(`revoke display link #${linkId}`);
  const [gone] = await db.update(displayLinks).set({ revokedAt: new Date() })
    .where(and(eq(displayLinks.id, linkId), eq(displayLinks.eventId, id), isNull(displayLinks.revokedAt))).returning({ id: displayLinks.id });
  if (gone) await audit(db, actor, "event.display_link.revoke", `Revoked display link #${linkId} for event #${id}`);
  refresh();
}
