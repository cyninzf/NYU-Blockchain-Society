import "server-only";
import { headers } from "next/headers";
import { isAdminAuthorized } from "./admin-auth";
import { getDb } from "./db";

/** For admin server actions: they can be invoked from any path, so re-check basic auth here. */
export async function requireAdmin() {
  if (!isAdminAuthorized((await headers()).get("authorization"))) throw new Error("Unauthorized");
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  return db;
}
