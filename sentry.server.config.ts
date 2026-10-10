import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options";

// Server (Node.js) errors. Off without SENTRY_DSN. Never capture local variables (they hold
// names, emails and tokens).
if (process.env.SENTRY_DSN) Sentry.init({ ...sentryOptions(process.env.SENTRY_DSN, process.env.VERCEL_ENV), includeLocalVariables: false });
