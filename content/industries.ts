// The three blocks of the logo. Order matters: index 0 is Blockchain (top block),
// and it matches the headline words, the join picks and the story steps.

export type IndustryId = "blockchain" | "finance" | "ai";
export const INDUSTRY_IDS: IndustryId[] = ["blockchain", "finance", "ai"];

export type Industry = {
  /** Stored in members.blocks. */
  id: IndustryId;
  name: string;
  /** Word as it appears in the headline, "Blockchain, Finance & AI." */
  headlineWord: string;
  /** Which cube of the 3D logo this industry lights (0 = AI, 1 = Finance, 2 = Blockchain). */
  cube: number;
  /** Topic tags on the hero label ("FOCUS 01 · BLOCKCHAIN") when the block or its word is hovered. */
  topics: string[];
  /** Focus card copy. */
  description: string;
  seenLead: string;
  seen: string;
};

export const industries: Industry[] = [
  {
    id: "blockchain",
    name: "Blockchain",
    headlineWord: "Blockchain,",
    cube: 2,
    topics: ["Stablecoins", "Tokenization", "Payments", "Digital-asset markets"],
    description: "Stablecoins, tokenization, payments, and the digital-asset markets built on top.",
    seenLead: "At our conference:",
    seen: "stablecoins and cross-border payments, consumer adoption, and a fireside with EigenLayer.",
  },
  {
    id: "finance",
    name: "Finance",
    headlineWord: "Finance",
    cube: 1,
    topics: ["Banks", "Asset managers", "Regulators", "Adoption"],
    description: "How banks, asset managers, and regulators adopt and govern new technology.",
    seenLead: "At our conference:",
    seen: "investment funds, institutional adoption with BlackRock and J.P. Morgan, TradFi meets blockchain, and two legal and regulatory panels.",
  },
  {
    id: "ai",
    name: "AI",
    headlineWord: "& AI.",
    cube: 0,
    topics: ["Agents", "Compute", "Payment rails"],
    description: "Agents and compute, and the rails that let software pay, settle, and transact on its own.",
    seenLead: "Our newest focus,",
    seen: "as AI agents start to hold and move digital assets.",
  },
];
