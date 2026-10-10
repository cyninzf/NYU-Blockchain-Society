"use client";

export default function PrintButton({ className }: { className?: string }) {
  return <button type="button" className={className} onClick={() => window.print()}>Print</button>;
}
