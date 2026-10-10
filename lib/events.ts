import "server-only";
import { asc, ne } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { siteName, siteUrl } from "@/content/site";
import { getDb } from "./db";
import { events, type EventRow } from "./db/schema";
import { SLUG_RE } from "./event-fields";
import { eventOver } from "./event-time";

// Public events: published and cancelled ones, never drafts. Cached under the "events" tag
// (every admin change refreshes it) and re-split into upcoming and past at least hourly.

export type PublicEvent = Pick<EventRow, "id" | "title" | "kind" | "slug" | "startsAt" | "endsAt" | "venueName" | "address" | "description" | "registrationUrl" | "cohost" | "updatedAt"> & {
  status: "published" | "cancelled";
  /** Ended (or, without an end time, started) as of the cached read. */
  over: boolean;
};

type Wire = Omit<PublicEvent, "startsAt" | "endsAt" | "updatedAt"> & { startsAt: string; endsAt: string | null; updatedAt: string };
const fromWire = (e: Wire): PublicEvent => ({ ...e, startsAt: new Date(e.startsAt), endsAt: e.endsAt ? new Date(e.endsAt) : null, updatedAt: new Date(e.updatedAt) });

async function load(): Promise<Wire[]> {
  "use cache";
  cacheTag("events");
  cacheLife("hours");
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.select({
      id: events.id, title: events.title, kind: events.kind, slug: events.slug, startsAt: events.startsAt, endsAt: events.endsAt, venueName: events.venueName,
      address: events.address, description: events.description, registrationUrl: events.registrationUrl, cohost: events.cohost,
      status: events.status, updatedAt: events.updatedAt,
    }).from(events).where(ne(events.status, "draft")).orderBy(asc(events.startsAt));
    const now = Date.now();
    return rows.map((e) => ({
      ...e, status: e.status as PublicEvent["status"], over: eventOver(e, now),
      startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null, updatedAt: e.updatedAt.toISOString(),
    }));
  } catch (e) {
    console.error("events failed", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Upcoming (soonest first; cancelled ones stay, marked, until they'd have ended) and past
 * (newest first; published only, so a cancelled event disappears once its date has passed).
 */
export async function publicEvents() {
  const all = (await load()).map(fromWire);
  return { upcoming: all.filter((e) => !e.over), past: all.filter((e) => e.over && e.status === "published").reverse() };
}

/** Every slug with a public page: published events, and cancelled ones until their date. */
export async function publicSlugs() {
  const { upcoming, past } = await publicEvents();
  return [...upcoming, ...past].map((e) => e.slug);
}

/** A public event by slug, or null: drafts never, and a cancelled one only until its date. */
export async function publicEvent(slug: string): Promise<PublicEvent | null> {
  if (!SLUG_RE.test(slug)) return null;
  const e = (await load()).find((x) => x.slug === slug);
  return e && !(e.over && e.status === "cancelled") ? fromWire(e) : null;
}

/** schema.org Event, for the event's page and (nested, without @context) the home page's Organization. */
export function eventJsonLd(e: PublicEvent, nested = false) {
  return {
    ...(nested ? {} : { "@context": "https://schema.org" }),
    "@type": "Event",
    name: e.title,
    url: `${siteUrl}/events/${e.slug}`,
    startDate: e.startsAt.toISOString(),
    ...(e.endsAt ? { endDate: e.endsAt.toISOString() } : {}),
    eventStatus: e.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(e.venueName || e.address ? { location: { "@type": "Place", name: e.venueName ?? e.address, ...(e.address ? { address: e.address } : {}) } } : {}),
    ...(e.description ? { description: e.description } : {}),
    organizer: { "@type": "Organization", name: siteName, url: `${siteUrl}/` },
    ...(e.registrationUrl && e.status === "published" ? { offers: { "@type": "Offer", url: e.registrationUrl } } : {}),
  };
}
