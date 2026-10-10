import "server-only";
import type { Db } from "./db";
import { pendingJoins, type PendingJoin } from "./db/schema";

// Joins and check-in quick joins the bot guard flagged (round 20): kept here, never in members,
// so no count, block number, email or contact link sees them until a super admin says "Not spam".

export type NewPendingJoin = Omit<PendingJoin, "id" | "createdAt">;

export async function savePendingJoin(db: Db, p: NewPendingJoin) {
  const [row] = await db.insert(pendingJoins).values(p).returning({ id: pendingJoins.id });
  return row.id;
}
