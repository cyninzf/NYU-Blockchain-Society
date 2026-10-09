import "server-only";
import { cookies } from "next/headers";
import { MEMBER_COOKIE, readSession } from "./session-token";

/** The member signed in through an "Update your block" link, or null. */
export async function memberIdFromSession(): Promise<number | null> {
  const s = readSession("member", (await cookies()).get(MEMBER_COOKIE)?.value);
  const id = Number(s?.subject);
  return Number.isInteger(id) && id > 0 ? id : null;
}
