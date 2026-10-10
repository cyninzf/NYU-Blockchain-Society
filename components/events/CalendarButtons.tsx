import type { CalendarLinks } from "@/lib/calendar";
import Icon from "../Icon";

/** "Add to calendar": Google, Outlook and Apple (.ics). Plain links, usable on server and client. */
export default function CalendarButtons({ links, className = "cal" }: { links: CalendarLinks; className?: string }) {
  return (
    <p className={className}>
      <span className="cal-h">Add to calendar</span>
      <a href={links.google} target="_blank" rel="noopener">Google <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span></a>
      <a href={links.outlook} target="_blank" rel="noopener">Outlook <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span></a>
      <a href={links.ics} download>Apple (.ics)</a>
    </p>
  );
}
