// Programs people can ask to hear about from the join flow (`notify`).

/** Old rows may also hold "mentorship". */
export type Notify = "networking" | "accelerator" | "conference";
export const NOTIFY: Notify[] = ["networking", "accelerator", "conference"];

/** Line added to the join success screen when someone came from a block's "Get notified". */
export const notifyMessages: Record<Notify, string> = {
  networking: "We'll tell you about upcoming networking events.",
  accelerator: "We'll tell you when the Accelerator launches.",
  conference: "We'll tell you when the next conference is announced.",
};

/** Shown above the join flow's first question when it was opened from that program's "Get notified" (round 14). */
export const notifyIntro: Record<Notify, string> = {
  networking: "Join the society to hear about upcoming networking events",
  accelerator: "Join the society to hear about the accelerator",
  conference: "Join the society to hear when the next conference is announced",
};
