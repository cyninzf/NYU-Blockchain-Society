import CopyButton from "@/components/CopyButton";
import { baseUrl } from "@/lib/base-url";
import { eventPath, eventSource } from "@/lib/event-fields";
import styles from "../admin.module.css";

/**
 * A published event's share link: its public page with ?src=event-<slug>. Anyone who joins after
 * landing from it (in the same tab session) has that source stored on their member row.
 */
export default function ShareLink({ slug }: { slug: string }) {
  const url = `${baseUrl()}${eventPath(slug)}?src=${eventSource(slug)}`;
  return (
    <div className={styles.share}>
      <code>{url}</code>
      <CopyButton text={url} label={`Copy the share link for ${slug}`} />
    </div>
  );
}
