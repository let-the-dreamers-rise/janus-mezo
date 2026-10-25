import type { AccountSnapshot } from "@/lib/chain/account-snapshot";

export type ChecklistId = "wallet" | "kit" | "gauge" | "bid" | "deposit" | "round" | "boost" | "claim";

export interface ChecklistStep {
  readonly id: ChecklistId;
  readonly title: string;
  readonly detail: string;
  /// Where the step is done: a page, or an anchor on the start page. None for the wallet.
  readonly href?: string;
  readonly done: boolean;
}

const ONE = 10n ** 18n;

const STEPS: readonly Omit<ChecklistStep, "done">[] = [
  {
    id: "wallet",
    title: "Connect a wallet",
    detail: "A demo wallet takes one click and lives in this browser. Bitcoin and EVM wallets work too.",
  },
  {
    id: "kit",
    title: "Get the starter kit",
    detail: "Gas BTC, MUSD, a veBTC NFT and a veMEZO NFT, sent free by the Janus faucet wallet.",
    href: "#starter-kit",
  },
  {
    id: "gauge",
    title: "Create a boost gauge",
    detail: "veMEZO votes reach a veBTC NFT through its gauge. It is one call on the Boost page.",
    href: "/boost/",
  },
  {
    id: "bid",
    title: "Place a bid",
    detail: "Offer MUSD per 1,000 votes and pick a target boost. The top of the book fills first.",
    href: "/boost/",
  },
  {
    id: "deposit",
    title: "Deposit your veMEZO",
    detail: "The vault mints jMEZO 1:1 and sells the lock's votes every epoch. 90% of each sale goes to jMEZO.",
    href: "/earn/",
  },
  {
    id: "round",
    title: "Run a round",
    detail: "Five public calls on the Market page sell the vault's votes to the best bids. Anyone can make them.",
    href: "/market/",
  },
  {
    id: "boost",
    title: "Apply your boost",
    detail: "One poke moves the votes you bought into your Mezo Earn boost.",
    href: "/boost/",
  },
  {
    id: "claim",
    title: "Claim your MUSD",
    detail: "jMEZO holders claim their share of every round on the Earn page.",
    href: "/earn/",
  },
];

interface ChecklistInput {
  /// A wallet that can sign. A read-only ?as= preview is not one.
  readonly connected: boolean;
  readonly account: AccountSnapshot | undefined;
}

/// The getting-started steps, each ticked from chain data alone, so progress survives a
/// reload, another browser, or doing a step outside Janus.
export function checklist({ connected, account }: ChecklistInput): readonly ChecklistStep[] {
  const veBtc = account?.veBtc ?? [];
  const earned = (account?.claimable ?? 0n) > 0n || (account?.claimed ?? 0n) > 0n;
  const votesLanded = veBtc.some((nft) => nft.gaugeWeight > 0n);
  const done: Readonly<Record<ChecklistId, boolean>> = {
    wallet: true,
    kit: account !== undefined && (veBtc.length > 0 || account.veMezo.length > 0 || account.jmezo > 0n),
    gauge: veBtc.some((nft) => nft.gauge !== undefined),
    bid: veBtc.some((nft) => nft.orderId !== 0n) || votesLanded,
    deposit: (account?.jmezo ?? 0n) > 0n,
    round: votesLanded || earned,
    boost: veBtc.some((nft) => nft.appliedBoost > ONE),
    claim: (account?.claimed ?? 0n) > 0n,
  };
  return STEPS.map((step) => ({ ...step, done: connected && done[step.id] }));
}

export const nextStep = (steps: readonly ChecklistStep[]): ChecklistStep | undefined => steps.find((step) => !step.done);
