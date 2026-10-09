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

/** ?src from the current URL, else the one remembered this session. */
export function joinSource(): string | undefined {
  try {
    const s = new URLSearchParams(location.search).get("src") ?? sessionStorage.getItem(KEY);
    return s && RE.test(s) ? s : undefined;
  } catch {
    return undefined;
  }
}
