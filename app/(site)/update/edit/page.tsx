import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { countIsPublic } from "@/lib/chain-stats";
import { getDb } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { unsubscribeUrl } from "@/lib/member-email";
import { memberIdFromSession } from "@/lib/member-session";
import { signOutMember } from "../actions";
import EditBlock from "./EditBlock";
import s from "../../account.module.css";

export const metadata: Metadata = {
  title: "Update your block",
  robots: { index: false, follow: false },
};

export default function EditPage() {
  return (
    <div className={`${s.page} page-top`}>
      <div className="wrap" data-bg="dim">
        <p className="kicker mono">Your block</p>
        <Suspense fallback={<h1>Update your block</h1>}><Editor /></Suspense>
      </div>
    </div>
  );
}

async function Editor() {
  const id = await memberIdFromSession();
  const db = getDb();
  const [m] = id && db ? await db.select({
    blocks: members.blocks, notify: members.notify, linkedinUrl: members.linkedinUrl, role: members.role, company: members.company,
    school: members.school, gradYear: members.gradYear, location: members.location,
  }).from(members).where(eq(members.id, id)) : [];
  if (!id || !m) {
    return (
      <>
        <h1>Update your block</h1>
        <p className={s.lede}>Your link has expired. <a href="/update">Ask for a new one</a>.</p>
      </>
    );
  }
  return (
    <>
      <h1>{(await countIsPublic(db!)) ? `Block #${id}` : "Your block"}</h1>
      <p className={s.lede}>Change your blocks, details and what we email you about. Every field is optional.</p>
      <EditBlock b={m} />
      <div className={`${s.small} ${s.actions}`} style={{ marginTop: 28 }}>
        <a href={unsubscribeUrl(id)}>Unsubscribe from all emails</a>
        <form action={signOutMember}><button className={s.link} type="submit">Sign out</button></form>
      </div>
    </>
  );
}
