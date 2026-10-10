// /contact (round 19): the society's only public way in. There is no public email address.
import type { ContactTopic } from "@/lib/db/schema";

export const contactPage = {
  title: "Contact",
  description: "Get in touch with NYU Blockchain Society, or make a privacy request to access or delete your data.",
  intro: "Questions, ideas, or a privacy request: send us a note and an organizer will reply by email.",
};

export const TOPIC_LABELS: Record<ContactTopic, string> = {
  general: "General question",
  privacy_access: "Privacy request: access my data",
  privacy_delete: "Privacy request: delete my data",
};

/** Privacy requests are confirmed by email before anyone acts on them (round 19). */
export const isPrivacyTopic = (t: ContactTopic) => t !== "general";
