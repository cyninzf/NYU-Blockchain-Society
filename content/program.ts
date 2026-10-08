// Conference programs: sessions with moderator and speakers. Editions live in conferences.ts.
// Never invent titles: leave out whatever isn't confirmed.

/** Shown as "name, title, org". Leave out what isn't confirmed: never invent titles. */
export type Person = { name?: string; title?: string; org: string };

export type Session = {
  time: string;
  title: string;
  /** Firms, shown on the collapsed row. */
  who: string;
  moderator?: Person;
  speakers: Person[];
};

export const program2024: Session[] = [
  {
    time: "10:00",
    title: "Stablecoins and cross-border payments",
    who: "Microsoft, Solana Foundation, a16z, Pockyt",
    moderator: { name: "Yeho Hwang", org: "Consensus" },
    speakers: [
      { name: "Yorke Rhodes", title: "Co-Founder", org: "Microsoft Blockchain" },
      { name: "Jon Wong", title: "Head of Engineering", org: "Solana Foundation" },
      { name: "Sam Broner", title: "Investor", org: "a16z" },
      { name: "Mason Lin", title: "CEO", org: "Pockyt" },
    ],
  },
  {
    time: "11:00",
    title: "Consumer adoption of blockchain",
    who: "Solana Foundation, Hedera, Magic Labs, Kraken, C14",
    moderator: { name: "Lawrence Lewitinn", title: "Managing Editor for North America", org: "The Block" },
    speakers: [
      { name: "Pedro Miranda", org: "Solana Foundation" },
      { name: "Andrew Stakiwicz", org: "Hedera Hashgraph" },
      { name: "Sung Hong", org: "Magic Labs" },
      { name: "Thomas Perfumo", org: "Kraken" },
      { name: "Erich Grant", title: "CEO", org: "C14" },
    ],
  },
  {
    time: "12:45",
    title: "Fireside with EigenLayer",
    who: "Andrew Ferraro, EigenLayer",
    speakers: [{ name: "Andrew Ferraro", org: "EigenLayer" }],
  },
  {
    time: "13:00",
    title: "Investment funds: trends and insights",
    who: "North Island Ventures, Messari, Variant",
    moderator: { name: "Eric Bai", title: "Founding Partner", org: "PSE Trading" },
    speakers: [
      { name: "Travis Scher", title: "Managing Partner & Co-Founder", org: "North Island Ventures" },
      { name: "Dylan Bane", title: "Enterprise Research", org: "Messari" },
      { name: "Alana Levin", org: "Variant" },
    ],
  },
  {
    time: "14:00",
    title: "In the crypto legal trenches",
    who: "Espresso Systems, Willkie Farr & Gallagher, Nillion, Talos",
    moderator: { name: "Vince Dowdie", org: "Kado" },
    speakers: [
      { name: "Ahmed Ghappour", org: "Espresso Systems" },
      { name: "Kari Larsen", org: "Willkie Farr & Gallagher" },
      { name: "Alex Page", title: "CEO", org: "Nillion" },
      { name: "Andrew Murphy", org: "Talos" },
    ],
  },
  {
    time: "15:00",
    title: "Institutional involvement in blockchain",
    who: "J.P. Morgan Onyx, Injective, BlackRock, Franklin Templeton",
    // Society co-lead: firm only, names stay out of this public repo.
    moderator: { org: "Light Node Ventures" },
    speakers: [
      { name: "Keerthi Moudgal", org: "Onyx / J.P. Morgan" },
      { name: "Eric Chen", org: "Injective" },
      { name: "Kevin Tang", title: "Director of Digital Assets", org: "BlackRock" },
      { name: "Greg Scanlon", org: "Franklin Templeton" },
    ],
  },
  {
    time: "16:00",
    title: "Traditional finance meets blockchain",
    who: "Kadena, Talos, Shift Markets, Metaversal",
    // Society co-lead: firm only, names stay out of this public repo.
    moderator: { org: "Harmonic Chain Digital" },
    speakers: [
      { name: "Annelise Osborne", org: "Kadena" },
      { name: "Anton Katz", title: "CEO", org: "Talos" },
      { name: "Ian McAfee", title: "CEO", org: "Shift Markets" },
      { name: "Dan Schmerin", org: "Metaversal" },
    ],
  },
  {
    time: "17:00",
    title: "The current regulatory environment",
    who: "Wyoming Stable Token Commission, GSR, Blockchain Association",
    moderator: { name: "Anish Rane", title: "President", org: "NYU Blockchain and Fintech Club" },
    speakers: [
      { name: "Debra Brookes", title: "Chief Risk and Compliance Officer", org: "Wyoming Stable Token Commission" },
      { name: "Joshua Riezman", org: "GSR" },
      { name: "Sarah Milby", title: "Head of Policy", org: "Blockchain Association" },
    ],
  },
];

export const formatPerson = (p: Person) => [p.name, p.title, p.org].filter(Boolean).join(", ");
