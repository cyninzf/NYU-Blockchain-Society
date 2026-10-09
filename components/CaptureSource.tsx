"use client";

import { useEffect } from "react";
import { rememberSource } from "@/lib/join-source";

/** Remembers ?src= from whichever public page someone lands on, for the join flow. */
export default function CaptureSource() {
  useEffect(rememberSource, []);
  return null;
}
