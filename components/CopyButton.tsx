"use client";

import { useState, type ReactNode } from "react";

/** Copies `text` to the clipboard and announces the result. */
export default function CopyButton({ text, className, label, children }: { text: string; className?: string; label: string; children?: ReactNode }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {children}
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed: select and copy" : children ? "" : "Copy"}</span>
    </button>
  );
}
