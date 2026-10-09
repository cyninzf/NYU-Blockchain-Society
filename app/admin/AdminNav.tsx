"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@/lib/db/schema";
import styles from "./admin.module.css";

// Super-only tabs are hidden from admins; the pages and actions check the role themselves.
const TABS = [
  { href: "/admin", label: "Members" },
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/contacts/import", label: "Import contacts", superOnly: true },
  { href: "/admin/linkedin", label: "LinkedIn group" },
  { href: "/admin/linkedin/import", label: "Import LinkedIn group", superOnly: true },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/team", label: "Team", superOnly: true },
  { href: "/admin/media-kit-preview", label: "Media kit preview", superOnly: true },
] as const;

export default function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className={styles.tabs}>
      {TABS.filter((t) => role === "super_admin" || !("superOnly" in t)).map((t) => (
        <Link key={t.href} href={t.href} aria-current={pathname === t.href ? "page" : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
