"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import OpenJoin from "./OpenJoin";

export default function Nav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    // Nav background after the hero.
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={solid ? "nav solid" : "nav"}>
      <div className="wrap">
        <a className="brand" href="#top" aria-label="NYU Blockchain Society, home">
          <Image className="mk" src="/brand/mark-node-white.svg" width={30} height={30} alt="" priority />
          <span>NYU Blockchain Society</span>
        </a>
        <ul>
          <li className="l"><a href="#chain">Events</a></li>
          <li className="l"><a href="#industries">Focus</a></li>
          <li className="l"><a href="#conference">Conference</a></li>
          <li><OpenJoin className="btn btn-w">Join</OpenJoin></li>
        </ul>
      </div>
    </header>
  );
}
