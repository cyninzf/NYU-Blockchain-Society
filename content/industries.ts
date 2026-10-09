// The three blocks of the logo. Order matters: index 0 is Blockchain (top block),
// and it matches the headline words, the join picks and the Focus blocks (content/focus.ts).

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
};

export const industries: Industry[] = [
  {
    id: "blockchain",
    name: "Blockchain",
    headlineWord: "Blockchain,",
    cube: 2,
  },
  {
    id: "finance",
    name: "Finance",
    headlineWord: "Finance",
    cube: 1,
  },
  {
    id: "ai",
    name: "AI",
    headlineWord: "& AI.",
    cube: 0,
  },
];
