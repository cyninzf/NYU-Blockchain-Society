// The NYU Blockchain Conference. Use "registrations", never "attendees".

export const conference = {
  registrations: 632,
  speakers: 35,
  panels: 7,
  year: 2024,
  date: "November 1, 2024",
  venue: "New York University",
  address: "New York University, 44 West 4th Street",
};

export type Session = { time: string; title: string; who: string };

export const program: Session[] = [
  { time: "10:00", title: "Stablecoins and cross-border payments", who: "Microsoft, Solana Foundation, a16z, Pockyt" },
  { time: "11:00", title: "Consumer adoption of blockchain", who: "Solana Foundation, Hedera, Magic Labs, Kraken, C14" },
  { time: "12:45", title: "Fireside with EigenLayer", who: "Andrew Ferraro, EigenLayer" },
  { time: "13:00", title: "Investment funds: trends and insights", who: "North Island Ventures, Messari, Variant" },
  { time: "14:00", title: "In the crypto legal trenches", who: "Espresso Systems, Willkie Farr & Gallagher, Nillion, Talos" },
  { time: "15:00", title: "Institutional involvement in blockchain", who: "J.P. Morgan Onyx, Injective, BlackRock, Franklin Templeton" },
  { time: "16:00", title: "Traditional finance meets blockchain", who: "Kadena, Talos, Shift Markets, Metaversal" },
  { time: "17:00", title: "The current regulatory environment", who: "Wyoming Stable Token Commission, GSR, Blockchain Association" },
];
