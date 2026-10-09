import type { Metadata } from "next";
import ImportRoster from "./ImportRoster";

export const metadata: Metadata = {
  title: "Import LinkedIn group · Admin",
  robots: { index: false, follow: false },
};

export default function ImportRosterPage() {
  return (
    <>
      <h1>Import LinkedIn group</h1>
      <ImportRoster />
    </>
  );
}
