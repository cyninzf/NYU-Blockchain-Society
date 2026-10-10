// The honeypot field (round 20). Chrome Autofill classifies fields by name, id and nearby text and
// ignores autocomplete="off": "website" and then "hp_x7" (Chrome reads "hp" as a phone field, and
// took the page intro above it as its label) were filled for real people. So: a meaningless name
// and id with nothing Chrome's heuristics match, an unknown autocomplete token, a meaningless
// aria-label (with no label at all Chrome borrows the page's heading or intro text and fills it),
// and the field placed last in the form, after the submit button, away from any text.
// Shared by the forms (components/Honeypot.tsx) and the server.
export const HONEYPOT_FIELD = "zq_k4v";
