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
