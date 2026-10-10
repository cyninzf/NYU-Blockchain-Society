import Link from "next/link";

/** Under every form that collects details (round 16). */
export default function PrivacyNote({ className = "privacy-note" }: { className?: string }) {
  return <p className={className}>See our <Link href="/privacy">privacy policy</Link>.</p>;
}
