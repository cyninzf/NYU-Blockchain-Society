// Where a member came from (?src=, e.g. ?src=linkedin on a launch post or a QR code at an
// event, else the referring site), stored in members.source when they join. Kept for the tab's session so it
// survives moving between pages before joining. Browser only.

// Two kinds of source, kept apart so a button never hides how someone arrived (round 22):
// - the arrival: ?src= on the page they landed on, else the referring site's domain as
//   "ref-<domain>" (ref-linkedin.com, ref-t.co, ref-x.com) when another site sent them;
// - a pick: the source a link inside the site carries ("Get notified" → chain-accelerator,
//   an event's join button → event-<slug>), used when the arrival has no ?src=.
const KEY = "nyubs:src";
const PICK_KEY = "nyubs:src-pick";
const RE = /^[\w.-]{1,40}$/;
const REF = "ref-";

const get = (k: string) => { const s = sessionStorage.getItem(k); return s && RE.test(s) ? s : undefined; };

/** "https://www.linkedin.com/feed/" → "ref-linkedin.com"; nothing for our own pages or no referrer. */
function referrerSource(): string | undefined {
  try {
    const host = new URL(document.referrer).hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
    if (!host || host === location.hostname.replace(/^www\./, "")) return undefined;
    const s = REF + host;
    return RE.test(s) ? s : undefined;
  } catch {
    return undefined;
  }
}

/** Remember how someone arrived (called once per tab on the first public page). An explicit ?src= wins; a referrer only fills a blank. */
export function rememberSource() {
  try {
    const s = new URLSearchParams(location.search).get("src");
    const stored = get(KEY);
    if (s && RE.test(s)) { if (!stored || stored.startsWith(REF)) sessionStorage.setItem(KEY, s); }
    else if (!stored) { const r = referrerSource(); if (r) sessionStorage.setItem(KEY, r); }
  } catch {}
}

/** Remember a source chosen by a link, e.g. an event's "Join the society to get the invite". */
export function setJoinSource(s: string) {
  try {
    if (RE.test(s)) sessionStorage.setItem(PICK_KEY, s);
  } catch {}
}

/** The source stored on the member: the arrival's ?src=, else a link's pick, else ?src= in the URL, else the referrer. */
export function joinSource(): string | undefined {
  try {
    const url = new URLSearchParams(location.search).get("src") ?? undefined;
    const arrival = get(KEY);
    const s = (arrival && !arrival.startsWith(REF) ? arrival : undefined) ?? get(PICK_KEY) ?? url ?? arrival;
    return s && RE.test(s) ? s : undefined;
  } catch {
    return undefined;
  }
}

/** The most recent intent (a link's pick, else ?src=, else the arrival): which event someone joined from. */
export function pickedSource(): string | undefined {
  try {
    const s = get(PICK_KEY) ?? new URLSearchParams(location.search).get("src") ?? get(KEY);
    return s && RE.test(s) ? s : undefined;
  } catch {
    return undefined;
  }
}

// An invite link's token (round 12): kept for the tab session once it's taken out of the URL,
// so it never sits in the address bar or history. Used once, on join.
const INVITE_KEY = "nyubs:invite";

export function rememberInvite(t: string) {
  try { if (t.length <= 400) sessionStorage.setItem(INVITE_KEY, t); } catch {}
}
export function storedInvite(): string | undefined {
  try { return sessionStorage.getItem(INVITE_KEY) ?? undefined; } catch { return undefined; }
}
export function clearInvite() {
  try { sessionStorage.removeItem(INVITE_KEY); } catch {}
}
