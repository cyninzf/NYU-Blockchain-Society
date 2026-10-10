"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { navBlocks as BLOCKS } from "@/content/site";
import Icon from "./Icon";
import OpenJoin from "./OpenJoin";

type Section = "chain" | null;

export default function Nav() {
  const pathname = usePathname();
  const home = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [section, setSection] = useState<Section>(null);
  const [menu, setMenu] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  // Nav background after the hero (always solid on other pages).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On the home page, mark "The chain" as current while it's in the middle of the viewport.
  useEffect(() => {
    const chain = home && document.getElementById("chain");
    if (!chain) return;
    const io = new IntersectionObserver(([e]) => setSection(e.isIntersecting ? "chain" : null), { rootMargin: "-45% 0px -45% 0px" });
    io.observe(chain);
    return () => io.disconnect();
  }, [home]);

  // Mobile menu sheet: lock page scroll, trap focus, close on Esc; focus returns to the button.
  useEffect(() => {
    if (!menu) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const el = sheet.current!, btn = menuBtn.current;
    const focusables = () => [...el.querySelectorAll<HTMLElement>("a[href], button")];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenu(false); return; }
      if (e.key !== "Tab") return;
      const f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    // The sheet is for small screens only: close it if the viewport grows past the breakpoint.
    const mq = matchMedia("(min-width: 901px)");
    const onMq = () => { if (mq.matches) setMenu(false); };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      root.style.overflow = prev;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      btn?.focus({ preventScroll: true });
    };
  }, [menu]);

  // Each block's page and everything under it (/events/<slug> lights Networking).
  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const current = (on: boolean, kind: "page" | "location") => (on ? { "aria-current": kind, className: "on" } : {});

  return (
    <header className={home && !scrolled && !menu ? "nav" : "nav solid"}>
      <div className="wrap">
        <Link className="brand" href="/#top" aria-label="NYU Blockchain Society, home">
          <Image className="mk" src="/brand/mark-node-white.svg" width={30} height={30} alt="" priority />
          <span>NYU Blockchain Society</span>
        </Link>
        <nav aria-label="Main">
          <ul>
            <li className="l"><Link href="/#chain" {...current(home && section === "chain", "location")}>The chain</Link></li>
            {BLOCKS.map((b) => <li className="l" key={b.href}><Link href={b.href} {...current(on(b.href), "page")}>{b.label}</Link></li>)}
            <li><OpenJoin className="btn btn-w">Join</OpenJoin></li>
            <li className="m">
              <button ref={menuBtn} className="menu-btn" type="button" aria-expanded={menu} aria-controls="menu-sheet" aria-haspopup="dialog" onClick={() => setMenu(true)}>
                <Icon name="menu" size={20} /><span className="sr">Menu</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
      {menu && createPortal(
        <div
          id="menu-sheet"
          className="sheet"
          ref={sheet}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onClick={(e) => { if ((e.target as Element).closest("a")) setMenu(false); }}
        >
          <div className="sheet-top wrap">
            <span className="brand"><Image className="mk" src="/brand/mark-node-white.svg" width={30} height={30} alt="" /><span>NYU Blockchain Society</span></span>
            <button className="menu-btn" type="button" onClick={() => setMenu(false)}><Icon name="close" size={20} /><span className="sr">Close menu</span></button>
          </div>
          <ol className="sheet-links wrap">
            <li style={{ "--i": 0 } as CSSProperties}><Link href="/#chain">The chain</Link></li>
            {BLOCKS.map((b, i) => <li style={{ "--i": i + 1 } as CSSProperties} key={b.href}><Link href={b.href} {...current(on(b.href), "page")}>{b.label}</Link></li>)}
            <li style={{ "--i": BLOCKS.length + 1 } as CSSProperties}><Link href="/media-kit" {...current(pathname === "/media-kit", "page")}>Media kit</Link></li>
            <li style={{ "--i": BLOCKS.length + 2 } as CSSProperties}><OpenJoin className="add">Add your block</OpenJoin></li>
          </ol>
        </div>,
        document.body,
      )}
    </header>
  );
}
