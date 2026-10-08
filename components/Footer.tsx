import Image from "next/image";
import { links } from "@/content/site";

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="f">
          <Image className="mk" src="/brand/mark-solid-white.svg" width={24} height={24} alt="NYU Blockchain Society logo" />
          <span>NYU Blockchain Society, New York</span>
        </div>
        <ul>
          <li><a href={links.x} target="_blank" rel="noopener">X</a></li>
          <li><a href={links.linkedin} target="_blank" rel="noopener">LinkedIn</a></li>
          <li><a href={links.nyuAlumni} target="_blank" rel="noopener">NYU Alumni</a></li>
        </ul>
      </div>
    </footer>
  );
}
