import { and, asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { industries } from "@/content/industries";
import { getDb } from "@/lib/db";
import { members } from "@/lib/db/schema";
import BlockGlyph from "./BlockGlyph";

/** The wall stays hidden until at least this many entries are approved. */
const MIN_ENTRIES = 12;

async function getWall() {
  "use cache";
  cacheTag("wall");
  cacheLife("hours");
  const db = getDb();
  if (!db) return [];
  try {
    return await db
      .select({ id: members.id, name: members.wallName, blocks: members.blocks })
      .from(members)
      .where(and(eq(members.showOnWall, true), eq(members.wallApproved, true)))
      .orderBy(asc(members.id));
  } catch (e) {
    console.error("wall query failed", e instanceof Error ? e.message : e);
    return [];
  }
}

const label = (blocks: string[]) => industries.filter((i) => blocks.includes(i.id)).map((i) => i.name).join(", ");

export default async function NetworkWall() {
  const rows = (await getWall()).filter((r) => r.name);
  if (rows.length < MIN_ENTRIES) return null;
  return (
    <section className="wall" id="wall" aria-labelledby="wall-h">
      <div className="wrap" data-bg="dim">
        <h2 id="wall-h">On the chain</h2>
        <p>Members who chose to add their name to the network.</p>
        <ul className="wall-list">
          {rows.map((r) => (
            <li key={r.id}>
              <BlockGlyph blocks={r.blocks} />
              <span>{r.name}</span>
              {r.blocks.length > 0 && <span className="sr"> ({label(r.blocks)})</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
