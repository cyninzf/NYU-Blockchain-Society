import { joinSection, links } from "@/content/site";
import OpenJoin from "./OpenJoin";

export default function JoinSection() {
  return (
    <section className="join" id="join" aria-labelledby="join-h">
      <div className="wrap">
        <h2 id="join-h">{joinSection.title}</h2>
        <p>{joinSection.text}</p>
        <div className="ctas">
          <OpenJoin className="btn btn-w">Add your block</OpenJoin>
          <a className="btn btn-o" href={links.linkedin} target="_blank" rel="noopener">Join on LinkedIn</a>
          <a className="btn btn-o" href={links.x} target="_blank" rel="noopener">Follow on X</a>
        </div>
      </div>
    </section>
  );
}
