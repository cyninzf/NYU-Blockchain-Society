"use client";

import { useEffect, useRef } from "react";
import { startBackdrop } from "./backdrop";

/** The fixed background layer behind every public page: violet night gradient + one canvas. */
export default function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => startBackdrop(ref.current!), []);
  return (
    <div className="backdrop" aria-hidden="true">
      <canvas ref={ref}></canvas>
    </div>
  );
}
