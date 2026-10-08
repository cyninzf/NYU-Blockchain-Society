import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

let db: Db | null = null;

/** Null when DATABASE_URL isn't set (local Codespaces dev): callers must degrade gracefully. */
export function getDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  db ??= drizzle(neon(url), { schema });
  return db;
}
