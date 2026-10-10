// "Add to calendar" for an event: Google Calendar, Outlook and an .ics file (Apple Calendar and
// anything else). Times go out in UTC (unambiguous; calendars show them in local time), with
// Google also told the event's zone, America/New_York. No server-only imports: the join flow
// gets these links from /api/events/<slug>.

import { EVENT_TZ } from "./event-time";

export type CalendarEvent = {
  title: string; slug: string; startsAt: Date; endsAt: Date | null;
  venueName: string | null; address: string | null; description: string | null;
  /** The event page, e.g. https://www.nyublockchainsociety.com/events/fall-mixer */
  pageUrl: string;
};
export type CalendarLinks = { google: string; outlook: string; ics: string };

/** Without an end time, calendars get two hours. */
const endOf = (e: CalendarEvent) => e.endsAt ?? new Date(e.startsAt.getTime() + 2 * 60 * 60 * 1000);
const compact = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20261112T233000Z
const where = (e: CalendarEvent) => [e.venueName, e.address].filter(Boolean).join(", ");
const details = (e: CalendarEvent) => [e.description, e.pageUrl].filter(Boolean).join("\n\n");

export function calendarLinks(e: CalendarEvent): CalendarLinks {
  const g = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${compact(e.startsAt)}/${compact(endOf(e))}`, details: details(e), location: where(e), ctz: EVENT_TZ });
  const o = new URLSearchParams({
    path: "/calendar/action/compose", rru: "addevent", subject: e.title,
    startdt: e.startsAt.toISOString(), enddt: endOf(e).toISOString(), body: details(e), location: where(e),
  });
  return {
    google: `https://calendar.google.com/calendar/render?${g}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${o}`,
    ics: `/events/${e.slug}/calendar.ics`,
  };
}

/** RFC 5545 text: escaped, and lines folded at 75 octets. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 75) { out.push(cur); cur = " " + ch; } else cur += ch;
  }
  return [...out, cur].join("\r\n");
};

export function icsFile(e: CalendarEvent, uid: string, stamp: Date) {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NYU Blockchain Society//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`, `DTSTAMP:${compact(stamp)}`, `DTSTART:${compact(e.startsAt)}`, `DTEND:${compact(endOf(e))}`,
    `SUMMARY:${esc(e.title)}`,
    ...(where(e) ? [`LOCATION:${esc(where(e))}`] : []),
    `DESCRIPTION:${esc(details(e))}`,
    `URL:${e.pageUrl}`,
    "END:VEVENT", "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}
