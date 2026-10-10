// /privacy (round 16): plain English, matching what the code actually does. Review with the
// maintainer before changing a promise here; update `privacyUpdated` with every change.

export const privacyUpdated = "October 10, 2026";

export const privacyDescription =
  "How NYU Blockchain Society collects, uses and protects your details: what we keep, who sees it, the services we use, and your choices and rights.";

/** Shown after "Your choices and rights" when REPLY_TO_EMAIL is set (round 17): a way in for people who never got a society email. */
export const privacyContactLead = "For access or deletion requests you can also write to";

export type PrivacySection = { id: string; title: string; paragraphs?: string[]; items?: string[]; after?: string[] };

export const privacySections: PrivacySection[] = [
  {
    id: "who",
    title: "Who we are",
    paragraphs: [
      "NYU Blockchain Society is an official NYU Alumni Club, run by volunteer organizers and based in New York. This page explains what we collect on nyublockchainsociety.com and in our emails, and what we do with it.",
    ],
  },
  {
    id: "collect",
    title: "What we collect",
    items: [
      "When you add your block: your name, email, which of Alumni, Industry professional, Faculty/Staff or Student fits you, the blocks you pick (Blockchain, Finance, AI), the updates you ask for, and which link you joined from (for example an event's page).",
      "Optional profile details, only if you add them: LinkedIn URL, role, company, NYU school, graduation year, and city and country.",
      "Contacts from our events and the LinkedIn group: when you registered for one of our events, the registration list (name, email and whether you checked in); from the society's LinkedIn group, the name and headline shown in its member list. Contacts are not members. We may invite a contact with an email address once; we won't email them again unless they join.",
      "Messages you send through the conference inquiry form and the accelerator forms, as you entered them.",
      "Event check-ins: which event you checked in to, and when.",
      "Email delivery only: whether an email was delivered, bounced or reported as spam, and whether you unsubscribed. We don't track opens or clicks.",
      "Security: to stop spam and abuse we keep a one-way code made from your IP address for about a day. We never store your IP address itself.",
    ],
  },
  {
    id: "why",
    title: "Why we use it",
    paragraphs: [
      "To run the society's events and programs, to send you the updates you chose (and the occasional message about events and programs, which you can stop at any time), to reply to your messages, and to keep the site secure.",
    ],
  },
  {
    id: "who-sees",
    title: "Who sees it",
    paragraphs: [
      "Only the society's organizers, in a private admin area that needs a personal sign-in. Your details are never shown publicly or to other members. We never sell them or share them with anyone for marketing. The only public figures are totals, such as the number of members, and only once there are at least 50.",
    ],
  },
  {
    id: "providers",
    title: "Service providers",
    paragraphs: ["We use a few services to run the site. They handle data on our behalf and only to provide their service:"],
    items: [
      "Vercel: hosting, and cookieless visitor analytics (page views and a few anonymous events, with no personal details).",
      "Neon: the database, through Vercel.",
      "Resend: sending our emails.",
      "Sentry: error reports, so we can fix problems. Names, email addresses, sign-in links and other personal details are removed before a report is sent.",
    ],
    after: ["These providers may process data outside your country, including in the United States."],
  },
  {
    id: "keep",
    title: "How long we keep it",
    items: [
      "Your block and profile: for as long as you're a member, until you ask us to delete them. Unsubscribing stops our emails but doesn't delete your block.",
      "Contacts: until you ask us to delete them.",
      "Inquiry and accelerator messages: as a record of the conversation, until you ask us to delete them.",
      "If you unsubscribe from an invitation, or an email to you bounces or is reported as spam, we keep a one-way code made from your address (not the address itself) so we never email it again.",
      "Sign-in links expire after 15 minutes and are cleared within days; sign-in sessions end when they expire or you sign out; spam-protection records are cleared after about a day.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    paragraphs: [
      "We only use essential cookies: one that keeps organizers signed in to the admin area, and one that keeps you signed in for 24 hours after you use an \"Update your block\" or check-in link. Our analytics don't use cookies. Some things are kept only in your own browser and never sent to us, such as the \"You\" marker after you join (\"Hide\" removes it). That's why there's no cookie banner.",
    ],
  },
  {
    id: "choices",
    title: "Your choices and rights",
    items: [
      "Unsubscribe: every email we send has an unsubscribe link that works in one click.",
      "Update your block: change your blocks, the updates you get and your optional details at /update.",
      "Access or deletion: to get a copy of what we hold about you, or to have it deleted, reply to any email from the society and an organizer will take care of it.",
    ],
  },
  {
    id: "gdpr",
    title: "Alumni in the EU and UK",
    paragraphs: [
      "If you're in the European Union or the United Kingdom, the GDPR (and the UK GDPR) gives you the right to access your data, correct it, have it deleted, restrict or object to how we use it, and receive it in a portable format, as well as the right to complain to your local data protection authority. We use your details because you gave them to us to join or to get in touch, and, for registrants of our past events, because of our legitimate interest in inviting them once to the society. Reply to any email from the society to use these rights.",
    ],
  },
];
