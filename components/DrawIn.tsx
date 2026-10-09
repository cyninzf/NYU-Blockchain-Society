"use client";

import { useEffect } from "react";

/** Adds `.in` to each element matching `selector` the first time it scrolls into view, so its
 *  block frame (edges and corner nodes, see `.frame` in globals.css) draws in once. */
export default function DrawIn({ selector }: { selector: string }) {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -15% 0px" });
    document.querySelectorAll(selector).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector]);
  return null;
}
