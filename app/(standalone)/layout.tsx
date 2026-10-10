import Backdrop from "@/components/backdrop/Backdrop";

// Pages opened at an event, on a phone at the door or on a screen in the room: event check-in
// and the live screen. The site's background, but no nav or footer.
export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Backdrop />
      <main>{children}</main>
    </>
  );
}
