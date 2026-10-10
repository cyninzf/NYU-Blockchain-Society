import Link from "next/link";
import styles from "../admin.module.css";

/** Inquiries has three views: conference inquiries, accelerator interest (round 14) and contact messages (round 19). */
export default function InquiryTabs({ current }: { current: "conference" | "accelerator" | "contact" }) {
  return (
    <nav aria-label="Inquiries" className={`${styles.tabs} ${styles.subtabs}`}>
      <Link href="/admin/inquiries" aria-current={current === "conference" ? "page" : undefined}>Conference</Link>
      <Link href="/admin/inquiries/accelerator" aria-current={current === "accelerator" ? "page" : undefined}>Accelerator</Link>
      <Link href="/admin/inquiries/contact" aria-current={current === "contact" ? "page" : undefined}>Contact</Link>
    </nav>
  );
}
