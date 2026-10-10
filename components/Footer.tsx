import Image from "next/image";
import Link from "next/link";
import { footerLinks, links } from "@/content/site";
import OpenJoin from "./OpenJoin";

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="f">
          <Image className="mk" src="/brand/mark-solid-white.svg" width={24} height={24} alt="NYU Blockchain Society logo" />
          <span>NYU Blockchain Society · Based in New York</span>
        </div>
        <ul>
          {/* The nav's links plus Networking, in block order (content/site.ts). */}
          {footerLinks.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}
          <li><OpenJoin>Add your block</OpenJoin></li>
          <li><Link href="/update">Update your block</Link></li>
          <li><Link href="/media-kit">Media kit</Link></li>
          <li><a href={links.x} target="_blank" rel="noopener">X</a></li>
          <li><a href={links.linkedin} target="_blank" rel="noopener">LinkedIn</a></li>
          <li><a href={links.nyuAlumni} target="_blank" rel="noopener">NYU Alumni</a></li>
        </ul>
      </div>
    </footer>
  );
}
