import "server-only";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { MEMBER_COOKIE } from "./session-token";
import { sessionSubject } from "./sessions";

/** The member signed in through an "Update your block" link (a live server-side session), or null. */
export async function memberIdFromSession(): Promise<number | null> {
  const id = Number(await sessionSubject(getDb(), "member", (await cookies()).get(MEMBER_COOKIE)?.value));
  return Number.isInteger(id) && id > 0 ? id : null;
}
