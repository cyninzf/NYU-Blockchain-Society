// Where a member came from (?src=, e.g. ?src=linkedin-group on the group's link or a QR code
// at an event), stored in members.source when they join. Kept for the tab's session so it
// survives moving between pages before joining. Browser only.

const KEY = "nyubs:src";
const RE = /^[\w-]{1,40}$/;

/** Remember ?src from the landing URL (called on every public page). */
export function rememberSource() {
  try {
    const s = new URLSearchParams(location.search).get("src");
    if (s && RE.test(s)) sessionStorage.setItem(KEY, s);
  } catch {}
}

/** Remember a source chosen by a link, e.g. an event's "Join the society to get the invite". */
export function setJoinSource(s: string) {
  try {
    if (RE.test(s)) sessionStorage.setItem(KEY, s);
  } catch {}
}

/** ?src from the current URL, else the one remembered this session. */
export function joinSource(): string | undefined {
  try {
    const s = new URLSearchParams(location.search).get("src") ?? sessionStorage.getItem(KEY);
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
