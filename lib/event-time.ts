// Event times: stored in UTC, entered and shown in New York time. No server-only imports, so
// the admin form and the public pages share it.

export const EVENT_TZ = "America/New_York";

const parts = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
};

/** How far New York is from UTC at that moment, in ms (e.g. -4 h in summer). */
const offsetAt = (ms: number) => {
  const p = parts(new Date(ms));
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
};

/** "2026-11-12T18:30" (a datetime-local value, New York time) → the UTC instant, or null. */
export function nyInputToDate(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const local = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes settle the offset across daylight-saving changes.
  let utc = local - offsetAt(local);
  utc = local - offsetAt(utc);
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The UTC instant → "2026-11-12T18:30" in New York time, for a datetime-local input. */
export function dateToNyInput(d: Date) {
  const p = parts(d), z = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TZ, weekday: "short", month: "short", day: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TZ, hour: "numeric", minute: "2-digit" });
const sameDay = (a: Date, b: Date) => dateToNyInput(a).slice(0, 10) === dateToNyInput(b).slice(0, 10);

/** "Thu, Nov 12, 2026" in New York. */
export const eventDay = (start: Date) => dayFmt.format(start);

/** "Thu, Nov 12, 2026 · 6:30–8:30 PM ET" (or with both dates when it runs past midnight). */
export function eventWhen(start: Date, end: Date | null) {
  if (!end) return `${dayFmt.format(start)} · ${timeFmt.format(start)} ET`;
  if (sameDay(start, end)) return `${dayFmt.format(start)} · ${timeFmt.formatRange(start, end)} ET`;
  return `${dayFmt.format(start)} ${timeFmt.format(start)} – ${dayFmt.format(end)} ${timeFmt.format(end)} ET`;
}

/** An event is upcoming until it ends (or, without an end time, until it starts). */
export const eventOver = (e: { startsAt: Date; endsAt: Date | null }, now: number) => (e.endsAt ?? e.startsAt).getTime() <= now;
