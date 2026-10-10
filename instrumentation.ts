import * as Sentry from "@sentry/nextjs";

// Error monitoring (round 16): Sentry for the server and edge runtimes, off without SENTRY_DSN.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

/** Uncaught errors in pages, route handlers, server actions and the proxy. */
export const onRequestError = Sentry.captureRequestError;
