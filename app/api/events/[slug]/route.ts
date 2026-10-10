import { baseUrl } from "@/lib/base-url";
import { calendarLinks } from "@/lib/calendar";
import { eventWhen } from "@/lib/event-time";
import { publicEvent } from "@/lib/events";

export type JoinEvent = { title: string; when: string; registrationUrl: string | null; calendar: ReturnType<typeof calendarLinks> };

// For the join success screen after ?src=event-<slug>: a published, upcoming event's public
// details only (what its page already shows). Anything else is a 404.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const e = await publicEvent((await params).slug);
  if (!e || e.status !== "published" || e.over) return Response.json({ error: "No such event" }, { status: 404 });
  const body: JoinEvent = {
    title: e.title,
    when: eventWhen(e.startsAt, e.endsAt),
    registrationUrl: e.registrationUrl,
    calendar: calendarLinks({ ...e, pageUrl: `${baseUrl()}/events/${e.slug}` }),
  };
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
