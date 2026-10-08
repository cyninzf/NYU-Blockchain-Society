"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import OpenJoin from "./OpenJoin";

type Section = "chain" | "focus" | null;

export default function Nav() {
  const pathname = usePathname();
  const home = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [section, setSection] = useState<Section>(null);

  // Nav background after the hero (always solid on other pages).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On the home page, mark the section in the middle of the viewport as current.
  useEffect(() => {
    if (!home) return;
    const targets: [Element, Section][] = [
      ...[...document.querySelectorAll(".step")].map((el) => [el, "focus"] as [Element, Section]),
      ...[document.getElementById("chain")].filter(Boolean).map((el) => [el!, "chain"] as [Element, Section]),
    ];
    const inView = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) inView.add(e.target); else inView.delete(e.target);
      setSection(targets.find(([el]) => inView.has(el))?.[1] ?? null);
    }, { rootMargin: "-45% 0px -45% 0px" });
    targets.forEach(([el]) => io.observe(el));
    return () => io.disconnect();
  }, [home]);

  const current = (on: boolean, kind: "page" | "location") => (on ? { "aria-current": kind, className: "on" } : {});

  return (
    <header className={home && !scrolled ? "nav" : "nav solid"}>
      <div className="wrap">
        <Link className="brand" href="/#top" aria-label="NYU Blockchain Society, home">
          <Image className="mk" src="/brand/mark-node-white.svg" width={30} height={30} alt="" priority />
          <span>NYU Blockchain Society</span>
        </Link>
        <nav aria-label="Main">
          <ul>
            <li className="l"><Link href="/#chain" {...current(home && section === "chain", "location")}>The chain</Link></li>
            <li className="l"><Link href="/#focus" {...current(home && section === "focus", "location")}>Focus</Link></li>
            <li className="l"><Link href="/conference" {...current(pathname.startsWith("/conference"), "page")}>Conference</Link></li>
            <li><OpenJoin className="btn btn-w">Join</OpenJoin></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
