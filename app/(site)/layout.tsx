import Backdrop from "@/components/backdrop/Backdrop";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Backdrop />
      <Nav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
