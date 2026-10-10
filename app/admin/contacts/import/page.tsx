import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Guard from "../../Guard";
import ImportContacts from "./ImportContacts";

export const metadata: Metadata = {
  title: "Import contacts · Admin",
  robots: { index: false, follow: false },
};

export default function ImportPage() {
  return (
    <>
      <h1>Import contacts</h1>
      <p><Link href="/admin/contacts">Back to contacts</Link></p>
      <Suspense fallback={null}>
        <Guard min="super_admin">{() => <ImportContacts />}</Guard>
      </Suspense>
    </>
  );
}
