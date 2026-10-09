"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

const TABS = [
  { href: "/admin", label: "Members" },
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/contacts/import", label: "Import contacts" },
] as const;

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className={styles.tabs}>
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={pathname === t.href ? "page" : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
