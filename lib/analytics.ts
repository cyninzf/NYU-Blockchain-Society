import { track } from "@vercel/analytics";

// Vercel Web Analytics custom events from the browser (round 16). No personal data: sources,
// program names, form types and block names only.
type Events = {
  join_completed: { src: string; notify: string };
  inquiry_submitted: { type: "conference" | "accelerator_founder" | "accelerator_supporter" };
  get_notified_clicked: { block: "conference" | "networking" | "accelerator" };
};

export function trackEvent<K extends keyof Events>(name: K, props: Events[K]) {
  try { track(name, props); } catch {}
}
