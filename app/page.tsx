import Nav from "@/components/Nav";
import Story from "@/components/story/Story";
import Chain from "@/components/Chain";
import Conference from "@/components/Conference";
import JoinSection from "@/components/JoinSection";
import NetworkWall from "@/components/NetworkWall";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Story />
        <Chain />
        <Conference />
        <NetworkWall />
        <JoinSection />
      </main>
      <Footer />
    </>
  );
}
