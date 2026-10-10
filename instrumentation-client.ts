import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options";

// Browser errors (round 16). Off without NEXT_PUBLIC_SENTRY_DSN. No session replay or tracing.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_VERCEL_ENV));

/** Required by the SDK for navigations; with tracing off it records nothing. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
