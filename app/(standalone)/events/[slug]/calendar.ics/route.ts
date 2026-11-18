import { baseUrl } from "@/lib/base-url";
import { icsFile } from "@/lib/calendar";
import { publicEvent } from "@/lib/events";

import { eventPath } from "@/lib/event-fields";
// "Apple" in the calendar buttons: an .ics file for a published, upcoming event.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await publicEvent(slug);
  if (!e || e.status !== "published" || e.over) return new Response("No such event.", { status: 404 });
  const ics = icsFile({ ...e, pageUrl: `${baseUrl()}${eventPath(e.slug)}` }, `event-${e.id}@nyublockchainsociety.com`, e.updatedAt);
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${e.slug}.ics"`, "Cache-Control": "public, max-age=300" },
  });
}
