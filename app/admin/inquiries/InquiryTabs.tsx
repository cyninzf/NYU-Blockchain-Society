import Link from "next/link";
import styles from "../admin.module.css";

/** Inquiries has two views (round 14): conference inquiries and accelerator interest. */
export default function InquiryTabs({ current }: { current: "conference" | "accelerator" }) {
  return (
    <nav aria-label="Inquiries" className={`${styles.tabs} ${styles.subtabs}`}>
      <Link href="/admin/inquiries" aria-current={current === "conference" ? "page" : undefined}>Conference</Link>
      <Link href="/admin/inquiries/accelerator" aria-current={current === "accelerator" ? "page" : undefined}>Accelerator</Link>
    </nav>
  );
}
