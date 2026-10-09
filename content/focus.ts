// Focus: one block per field. Each block describes its whole field; how the three converge
// lives only in `meets`. No dated news here, and never name specific chains or tokens:
// describe the field, not ecosystems. The hero labels show the first three tags of each
// block (focusTags), so the two can't drift apart.

import type { IndustryId } from "./industries";

export type FocusBlock = {
  id: IndustryId;
  title: string;
  description: string;
  /** In display order; the first three also label the hero block. */
  tags: string[];
  /** "Where it meets the others": one sentence. */
  meets: string;
};

export const focus: FocusBlock[] = [
  {
    id: "blockchain",
    title: "Blockchain",
    description: "The protocols and infrastructure behind digital assets, and the markets built on them: stablecoins, tokenization and DeFi.",
    tags: ["Infrastructure", "Stablecoins", "Tokenization", "DeFi", "Digital-asset markets", "Custody & security"],
    meets: "Tokenized markets, onchain settlement, and wallets for software agents.",
  },
  {
    id: "finance",
    title: "Finance",
    description: "Capital markets, investing and the institutions behind them: banking, asset management, venture, trading and fintech.",
    tags: ["Banking", "Capital markets", "Asset management", "Venture & private equity", "Fintech & payments", "Regulation & policy"],
    meets: "Institutions adopting digital assets, and AI reshaping investing and risk.",
  },
  {
    id: "ai",
    title: "AI",
    description: "The models, compute and agents redefining software, and the companies, capital and rules shaping them.",
    tags: ["Models", "Agents", "Compute", "AI in finance", "AI startups", "Safety & governance"],
    meets: "AI in trading, research and compliance, and agents that transact onchain.",
  },
];

/** The hero label's tags for a block: always the first three Focus tags. */
export const focusTags = (id: IndustryId) => focus.find((f) => f.id === id)!.tags.slice(0, 3);
