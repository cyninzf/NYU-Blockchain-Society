// The three blocks of the logo. Order matters: index 0 is Blockchain (top block),
// and it matches the headline words, the join picks and the story steps.

export type Industry = {
  name: string;
  /** Word as it appears in the headline, "Blockchain, finance & AI." */
  headlineWord: string;
  /** Which cube of the 3D logo this industry lights (0 = AI, 1 = Finance, 2 = Blockchain). */
  cube: number;
  /** Shown in the floating caption when the block is hovered. */
  caption: string;
  /** Pinned-story step copy. */
  description: string;
  seenLead: string;
  seen: string;
};

export const industries: Industry[] = [
  {
    name: "Blockchain",
    headlineWord: "Blockchain,",
    cube: 2,
    caption: "Stablecoins, tokenization, payments, and the digital-asset markets built on top.",
    description: "Stablecoins, tokenization, payments, and the digital-asset markets built on top.",
    seenLead: "At our conference:",
    seen: "stablecoins and cross-border payments, consumer adoption, and a fireside with EigenLayer.",
  },
  {
    name: "Finance",
    headlineWord: "finance",
    cube: 1,
    caption: "How banks, asset managers, and regulators adopt and govern new technology.",
    description: "How banks, asset managers, and regulators adopt and govern new technology.",
    seenLead: "At our conference:",
    seen: "investment funds, institutional adoption with BlackRock and J.P. Morgan, TradFi meets blockchain, and two legal and regulatory panels.",
  },
  {
    name: "AI",
    headlineWord: "& AI.",
    cube: 0,
    caption: "Agents and compute, and the rails that let software pay and transact on its own.",
    description: "Agents and compute, and the rails that let software pay, settle, and transact on its own.",
    seenLead: "Our newest focus,",
    seen: "as AI agents start to hold and move digital assets.",
  },
];
