// The honeypot field (round 20). Its name must not look like anything browsers or password
// managers autofill: the old name, "website", got filled for real people, whose messages were
// then silently dropped as bots. Shared by the forms (components/Honeypot.tsx) and the server.
export const HONEYPOT_FIELD = "hp_x7";
