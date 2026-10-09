"use client";

// Focus: three linked blocks, one per field. Each card is drawn like a block (edges and
// glowing corner nodes that draw in the first time it scrolls into view), and connectors
// with a node between the cards carry a dot from block to block every few seconds.

import { useEffect, useRef } from "react";
import { focus } from "@/content/focus";
import BlockGlyph from "../BlockGlyph";

export default function FocusBlocks({ register }: { register: (i: number, el: HTMLElement) => void }) {
  const list = useRef<HTMLOListElement>(null);

  // Edges draw in once, on first scroll into view.
  useEffect(() => {
    const items = [...list.current!.querySelectorAll<HTMLElement>(".fblk")];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -15% 0px" });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <ol className="fblocks" ref={list}>
      {focus.map((f, i) => (
        <li key={f.id} className="fblk" data-bg="dim" aria-labelledby={`focus-${f.id}`} ref={(el) => { if (el) register(i, el); }}>
          <span className="frame" aria-hidden="true">
            <i className="e t"></i><i className="e r"></i><i className="e b"></i><i className="e l"></i>
            <b className="c tl"></b><b className="c tr"></b><b className="c br"></b><b className="c bl"></b>
          </span>
          {i < focus.length - 1 && <span className="flink" aria-hidden="true"><i></i><b></b></span>}
          <div className="fhead mono">
            <span>Focus {String(i + 1).padStart(2, "0")} · {f.title}</span>
            <BlockGlyph blocks={[f.id]} size={26} />
          </div>
          <h3 id={`focus-${f.id}`}>{f.title}</h3>
          <p className="fdesc">{f.description}</p>
          <ul className="ftags" aria-label={`${f.title} topics`}>
            {f.tags.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <div className="meets">
            <p className="mono"><i aria-hidden="true"></i>Where it meets the others</p>
            <p>{f.meets}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
