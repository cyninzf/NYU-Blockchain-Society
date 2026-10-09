import type { Metadata } from "next";
import Boilerplate from "@/components/Boilerplate";
import { boilerplateStatus } from "@/content/boilerplate";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Media kit preview · Admin",
  robots: { index: false, follow: false },
};

export default function MediaKitPreviewPage() {
  const draft = boilerplateStatus === "draft";
  return (
    <>
      <h1>Media kit preview</h1>
      <p className={styles.lede}>
        {draft
          ? <>The boilerplate is a draft, so it&apos;s hidden on the public <a href="/media-kit">media kit</a>. Once it&apos;s reviewed, set <code>boilerplateStatus</code> to &ldquo;approved&rdquo; in <code>content/boilerplate.ts</code> and it appears there without the tag.</>
          : <>Approved: this is how the boilerplate appears on the public <a href="/media-kit">media kit</a>.</>}
      </p>
      <div className={styles.preview}>
        <Boilerplate draft={draft} />
      </div>
    </>
  );
}
