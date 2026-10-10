import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "./db";
import { events, type EventRow } from "./db/schema";
import { SLUG_RE } from "./event-fields";
import { eventOver } from "./event-time";

// Public events: published and cancelled ones, never drafts. Cached under the "events" tag
// (every admin change refreshes it) and re-split into upcoming and past at least hourly.

export type PublicEvent = Pick<EventRow, "id" | "title" | "slug" | "startsAt" | "endsAt" | "venueName" | "address" | "description" | "registrationUrl" | "cohost"> & {
  status: "published" | "cancelled";
};

const cols = {
  id: events.id, title: events.title, slug: events.slug, startsAt: events.startsAt, endsAt: events.endsAt, venueName: events.venueName,
  address: events.address, description: events.description, registrationUrl: events.registrationUrl, cohost: events.cohost, status: events.status,
};

type Wire = Omit<PublicEvent, "startsAt" | "endsAt"> & { startsAt: string; endsAt: string | null };
const fromWire = (e: Wire): PublicEvent => ({ ...e, startsAt: new Date(e.startsAt), endsAt: e.endsAt ? new Date(e.endsAt) : null });

async function load(): Promise<{ upcoming: Wire[]; past: Wire[] }> {
  "use cache";
  cacheTag("events");
  cacheLife("hours");
  const db = getDb();
  if (!db) return { upcoming: [], past: [] };
  try {
    const rows = await db.select(cols).from(events).where(ne(events.status, "draft")).orderBy(asc(events.startsAt));
    const now = Date.now();
    const wire = (e: (typeof rows)[number]): Wire => ({ ...e, status: e.status as PublicEvent["status"], startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null });
    return {
      // Cancelled events stay (marked) until they'd have ended, then disappear.
      upcoming: rows.filter((e) => !eventOver(e, now)).map(wire),
      past: rows.filter((e) => eventOver(e, now) && e.status === "published").reverse().map(wire),
    };
  } catch (e) {
    console.error("events failed", e instanceof Error ? e.message : e);
    return { upcoming: [], past: [] };
  }
}

/** Upcoming (soonest first, cancelled included) and past (newest first, published only). */
export async function publicEvents() {
  const { upcoming, past } = await load();
  return { upcoming: upcoming.map(fromWire), past: past.map(fromWire) };
}

async function loadOne(slug: string): Promise<Wire | null> {
  "use cache";
  cacheTag("events");
  cacheLife("hours");
  const db = getDb();
  if (!db) return null;
  const [e] = await db.select(cols).from(events).where(and(eq(events.slug, slug), ne(events.status, "draft")));
  return e ? { ...e, status: e.status as PublicEvent["status"], startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null } : null;
}

/** A published or cancelled event by slug, or null (drafts never). */
export async function publicEvent(slug: string): Promise<PublicEvent | null> {
  if (!SLUG_RE.test(slug)) return null;
  const e = await loadOne(slug);
  return e ? fromWire(e) : null;
}
