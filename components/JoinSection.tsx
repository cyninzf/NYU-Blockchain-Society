import { joinSection, links } from "@/content/site";
import Icon from "./Icon";
import OpenJoin from "./OpenJoin";

export default function JoinSection() {
  return (
    <section className="join" id="join" aria-labelledby="join-h">
      <div className="wrap">
        <h2 id="join-h">{joinSection.title}</h2>
        <p>{joinSection.text}</p>
        <div className="ctas">
          <OpenJoin className="btn btn-w">Add your block</OpenJoin>
        </div>
        <ul className="also">
          <li><a href={links.linkedin} target="_blank" rel="noopener">LinkedIn group <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span></a></li>
          <li><a href={links.x} target="_blank" rel="noopener">Follow on X <Icon name="arrow-up-right" /><span className="sr"> (opens in a new tab)</span></a></li>
        </ul>
      </div>
    </section>
  );
}
