// The "You · <first name>" marker on the hero logo after someone joins. It lives only in this
// browser's localStorage (never sent anywhere), expires after 30 days and can always be hidden.

import { INDUSTRY_IDS, type IndustryId } from "@/content/industries";

const KEY = "nyubs:you";
const TTL = 30 * 24 * 60 * 60 * 1000;

export type YouMarker = { name: string; blocks: IndustryId[] };

/** First name only: the marker never shows a full name or an email. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 40) ?? "";

export function saveMarker(name: string, blocks: IndustryId[]) {
  try { localStorage.setItem(KEY, JSON.stringify({ name: firstName(name), blocks, at: Date.now() })); } catch {}
}

/** The stored marker, or null (expired or unreadable markers are removed). */
export function loadMarker(): YouMarker | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    const ok = v && typeof v.at === "number" && Date.now() - v.at < TTL && typeof v.name === "string" && Array.isArray(v.blocks);
    if (!ok) { clearMarker(); return null; }
    return { name: firstName(v.name), blocks: v.blocks.filter((b: unknown): b is IndustryId => INDUSTRY_IDS.includes(b as IndustryId)) };
  } catch {
    return null;
  }
}

export function clearMarker() {
  try { localStorage.removeItem(KEY); } catch {}
}
