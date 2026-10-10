import type { Metadata } from "next";

export const metadata: Metadata = { title: "Not allowed", robots: { index: false, follow: false } };

/** 403, e.g. an admin trying an event change (super admins only). */
export default function Forbidden() {
  return (
    <main style={{ padding: "48px 20px", maxWidth: 640, margin: "0 auto" }}>
      <h1>Not allowed</h1>
      <p>Only super admins can do that. The attempt was logged. <a href="/admin">Back to the admin</a></p>
    </main>
  );
}
