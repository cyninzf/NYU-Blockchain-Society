import { cacheLife } from "next/cache";
import { featuredEvent } from "@/content/home-events";
import { nyInputToDate } from "@/lib/event-time";

/**
 * Whether the home page's featured event has ended, decided on the server (never in the browser,
 * so there's no hydration mismatch). Cached and re-checked every 15 minutes, so the card turns
 * into "Past event" at most that long after `endsAt` (New York time).
 */
export async function featuredEventOver() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  // No date yet (endsAt and startsAt null): never over.
  const at = featuredEvent.endsAt ?? featuredEvent.startsAt;
  const end = at ? nyInputToDate(at) : null;
  return end ? end.getTime() <= Date.now() : false;
}
