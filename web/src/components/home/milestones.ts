export type MilestoneStatus = "shipped" | "next";

export interface Milestone {
  readonly when: string;
  readonly name: string;
  readonly detail: string;
  readonly status: MilestoneStatus;
}

/// The public roadmap. Shipped items come first, in order; keep it in step with the deck.
export const MILESTONES: readonly Milestone[] = [
  { when: "Oct 2026", name: "Boost market on testnet", detail: "Vault, jMEZO and rounds on Mezo Matsnet.", status: "shipped" },
  { when: "Nov 2026", name: "v2 and a jMEZO pool", detail: "Bribe harvesting, guaranteed boost pokes, fungible jMEZO and a jMEZO/MUSD pool.", status: "shipped" },
  { when: "15 Nov 2026", name: "Mainnet launch", detail: "Both contracts live and verified on Mezo mainnet, with a capped vault.", status: "shipped" },
  { when: "15 Nov 2026", name: "Timelock and autopilot", detail: "Owner behind a 48-hour timelock, a scheduled keeper, round analytics and a veBTC re-lock autopilot.", status: "shipped" },
  { when: "This week", name: "First mainnet round", detail: "The first mainnet bid settled by the scheduled keeper, with every transaction on the Transparency page.", status: "next" },
  { when: "30 days", name: "First outside users", detail: "10 outside veBTC buyers and veMEZO depositors, then a Safe multisig as the timelock's proposer.", status: "next" },
  { when: "60-90 days", name: "Liquid jMEZO and an audit", detail: "Mainnet jMEZO/MUSD pool with a gauge, an external audit, then a higher cap.", status: "next" },
  { when: "Next quarter", name: "MUSD credit gauges", detail: "jMEZO votes that direct MUSD lending incentives, with voters as first loss.", status: "next" },
];
