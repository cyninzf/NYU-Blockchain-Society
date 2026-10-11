// Shared by the forms' "receive" functions (round 20).
/** Runs work after the response (the action passes next/server `after`); tests run it at once. */
export type Defer = (work: () => Promise<unknown>) => void;
