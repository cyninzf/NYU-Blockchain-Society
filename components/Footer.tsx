import Image from "next/image";
import Link from "next/link";
import { links } from "@/content/site";
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
          <li><OpenJoin>Add your block</OpenJoin></li>
          <li><Link href="/update">Update your block</Link></li>
          <li><Link href="/conference">Conference</Link></li>
          <li><Link href="/events">Events</Link></li>
          <li><Link href="/media-kit">Media kit</Link></li>
          <li><a href={links.x} target="_blank" rel="noopener">X</a></li>
          <li><a href={links.linkedin} target="_blank" rel="noopener">LinkedIn</a></li>
          <li><a href={links.nyuAlumni} target="_blank" rel="noopener">NYU Alumni</a></li>
        </ul>
      </div>
    </footer>
  );
}
