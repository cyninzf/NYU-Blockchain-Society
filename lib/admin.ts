import "server-only";
import { headers } from "next/headers";
import { isAdminAuthorized } from "./admin-auth";
import { getDb } from "./db";

/** For admin server actions: they can be invoked from any path, so re-check basic auth here. */
export async function requireAdmin() {
  return (await requireAdminUser()).db;
}

/** Same check, plus who is acting (the basic-auth user name), for the audit log. */
export async function requireAdminUser() {
  const auth = (await headers()).get("authorization");
  if (!isAdminAuthorized(auth)) throw new Error("Unauthorized");
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  // authorized implies a well-formed "Basic user:pass" header
  const decoded = atob(auth!.slice(6));
  return { db, actor: decoded.slice(0, decoded.indexOf(":")) };
}
