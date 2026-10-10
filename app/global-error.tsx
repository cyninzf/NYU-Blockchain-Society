"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort error page for errors in the root layout (round 16): reported to Sentry when it's
// on, with a plain way back. Inline styles: the app's CSS may not have loaded.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#1C0533", color: "#F5EEFB", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <main style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Something went wrong.</h1>
          <p style={{ color: "#CDBEDB", margin: "0 0 24px" }}>We&apos;ve been notified. Please try again.</p>
          <button type="button" onClick={reset} style={{ minHeight: 46, padding: "0 20px", borderRadius: 10, border: 0, background: "#fff", color: "#120A1C", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
