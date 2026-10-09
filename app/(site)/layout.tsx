import Backdrop from "@/components/backdrop/Backdrop";
import CaptureSource from "@/components/CaptureSource";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Backdrop />
      <CaptureSource />
      <Nav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
