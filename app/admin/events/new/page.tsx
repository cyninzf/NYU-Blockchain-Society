import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import EventForm, { EMPTY_EVENT } from "../EventForm";
import Guard from "../../Guard";

export const metadata: Metadata = {
  title: "New event · Admin",
  robots: { index: false, follow: false },
};

export default function NewEventPage() {
  return (
    <>
      <h1>New event</h1>
      <p><Link href="/admin/events">Back to events</Link></p>
      <Suspense fallback={null}>
        <Guard>{() => <EventForm e={EMPTY_EVENT} />}</Guard>
      </Suspense>
    </>
  );
}
