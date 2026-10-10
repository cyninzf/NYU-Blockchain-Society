import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options";

// Edge runtime errors. Off without SENTRY_DSN.
if (process.env.SENTRY_DSN) Sentry.init(sentryOptions(process.env.SENTRY_DSN, process.env.VERCEL_ENV));
