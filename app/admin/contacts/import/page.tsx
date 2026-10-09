import type { Metadata } from "next";
import ImportContacts from "./ImportContacts";

export const metadata: Metadata = {
  title: "Import contacts · Admin",
  robots: { index: false, follow: false },
};

export default function ImportPage() {
  return (
    <>
      <h1>Import contacts</h1>
      <ImportContacts />
    </>
  );
}
