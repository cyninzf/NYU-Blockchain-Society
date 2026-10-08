// Runs before `next build`. On Vercel, each deployment migrates its own database
// (preview → its Neon branch, production → main). Locally without DATABASE_URL it's a no-op.
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  if (process.env.VERCEL) {
    console.error("migrate: DATABASE_URL is not set for this Vercel environment.");
    process.exit(1);
  }
  console.log("migrate: DATABASE_URL not set, skipping migrations (local build).");
  process.exit(0);
}

const r = spawnSync("npx", ["drizzle-kit", "migrate"], { stdio: "inherit" });
process.exit(r.status ?? 1);
