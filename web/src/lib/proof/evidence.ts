import { SITE } from "@/config/site";
import { explorerUrl } from "@/lib/explorer";

/// proven: visible on chain or in the repo today. built: shipped and tested, first live run
/// still ahead. partial: some of the ask is done. open: not done.
export type ProofStatus = "proven" | "built" | "partial" | "open";

export interface ProofLink {
  readonly label: string;
  readonly kind: "tx" | "address" | "mainnet" | "code";
  readonly value: string;
}

export interface ProofItem {
  readonly id: string;
  readonly ask: string;
  readonly status: ProofStatus;
  readonly summary: string;
  /// What this item does not show. Required for anything short of proven.
  readonly limit?: string;
  readonly links: readonly ProofLink[];
}

const V1_MARKET = "0x9098b6f514f322A6f57501cdd92e7aBf79E41870";
const V1_VAULT = "0xDC1db035D17356Fc4aADd9cdB80F264512DA2879";
const V2_MARKET = "0xCE7f5e83372dFF1BCa16c2637F58f0fc1da5d72A";
const V2_VAULT = "0xFbbCDfDE533f630b6d07D7FE3087eEa4c3A97a64";
const POOL = "0x99e93E6C1bcCbb4DA415B6B3e7E08661AbC45cD4";

export const PROOF_ITEMS: readonly ProofItem[] = [
  {
    id: "outside-bids",
    ask: "Fill the outside bids",
    status: "partial",
    summary: "Round 2 filled bids #3 and #4, placed through the public app's demo wallet, and took veBTC #1718 and #1723 to 5x.",
    limit: "Those two bids came from our own testing, not from outside users. They prove the path works. Janus has no third-party bidders yet.",
    links: [
      { label: "Bid #3 placed", kind: "tx", value: "0xd22d1b92b1ece1e66de9252eadc8238c59bc0685ff2f680ca89b375a6d72116a" },
      { label: "Bid #4 placed", kind: "tx", value: "0xbe01546c4d4b917cdd876242d3169880f964873db59529a5e29cdf744bffc31e" },
      { label: "Votes cast", kind: "tx", value: "0xdf530ee96901fad31366e12fcfd975de7453d5936c54bdca63cd71996c2f47d3" },
    ],
  },
  {
    id: "rounds",
    ask: "Run several rounds",
    status: "partial",
    summary: "Two full rounds closed on Matsnet, one in each of two epochs. Round 2 charged 4.21 MUSD: 3.79 to jMEZO holders and 0.42 in fees.",
    limit: "All of that MUSD came from wallets we control, so it is not revenue. A round runs once per weekly epoch, and the next one on v2 can start after Nov 12 00:00 UTC.",
    links: [
      { label: "Round 1 finalized", kind: "tx", value: "0x4fd93bf600eb8893d5d1a7ccc41439a0245b92ba254419fbd9c6bd6a2f7691ab" },
      { label: "Round 2 finalized", kind: "tx", value: "0xcacac55587938e01302600ee0ef3fe141896e8ce38a6261fbab82cb59e0c54aa" },
    ],
  },
  {
    id: "bribes",
    ask: "Fix vault bribe claiming",
    status: "built",
    summary: "Anyone can call harvestBribes. Bribes a shard earned on BoostVoter stream to jMEZO holders over 7 days.",
    limit: "Covered by tests against a mock voter. No bribes have been harvested on chain yet.",
    links: [
      { label: "JanusVault.sol", kind: "code", value: "contracts/src/JanusVault.sol" },
      { label: "Tests", kind: "code", value: "contracts/test/JanusVaultSoundness.t.sol" },
    ],
  },
  {
    id: "pokes",
    ask: "Guarantee boost pokes",
    status: "built",
    summary: "A round now has a Poking step before it can close, and a buyer pays only once their boost is applied. Gas guards stop a caller from starving a poke.",
    limit: "Passes on a fork of real Mezo contracts. The first live run is the next v2 round.",
    links: [
      { label: "BoostMarket.sol", kind: "code", value: "contracts/src/BoostMarket.sol" },
      { label: "Tests", kind: "code", value: "contracts/test/BoostMarketPokes.t.sol" },
      { label: "Fork test", kind: "code", value: "contracts/test/fork/MatsnetFork.t.sol" },
    ],
  },
  {
    id: "fungibility",
    ask: "Make jMEZO fungible",
    status: "proven",
    summary: "jMEZO is now a share of all MEZO the vault locks, so any jMEZO is worth the same and redeeming costs a shard's current share of the vault.",
    links: [
      { label: "Shard deposited into v2", kind: "tx", value: "0x9fc1cd1b45ff6fa7c1c58d4452593736348316a182b686cb7b56140e56db4414" },
      { label: "jMEZO token", kind: "address", value: V2_VAULT },
    ],
  },
  {
    id: "verified",
    ask: "Verify both contracts on the Mezo explorer",
    status: "proven",
    summary: "Source is verified for both contracts, on v2 and on the earlier v1.",
    links: [
      { label: "v2 vault", kind: "address", value: V2_VAULT },
      { label: "v2 market", kind: "address", value: V2_MARKET },
      { label: "v1 vault", kind: "address", value: V1_VAULT },
      { label: "v1 market", kind: "address", value: V1_MARKET },
    ],
  },
  {
    id: "vebtc-address",
    ask: "Fix the mainnet veBTC address",
    status: "proven",
    summary: "Deploy.s.sol now uses the veBTC that the live mainnet BoostVoter boosts, and a test checks it against that contract on a mainnet fork.",
    links: [
      { label: "Mainnet veBTC", kind: "mainnet", value: "0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279" },
      { label: "Deploy.s.sol", kind: "code", value: "contracts/script/Deploy.s.sol" },
      { label: "Deploy.t.sol", kind: "code", value: "contracts/test/Deploy.t.sol" },
    ],
  },
  {
    id: "mainnet",
    ask: "Aim for a mainnet deployment",
    status: "open",
    summary: "The deploy script is ready and refuses to launch on mainnet without a named treasury and a deposit cap.",
    limit: "Not deployed on mainnet. Everything on this page is Matsnet testnet.",
    links: [{ label: "Deploy.s.sol", kind: "code", value: "contracts/script/Deploy.s.sol" }],
  },
  {
    id: "pool",
    ask: "Add a jMEZO/MUSD pool",
    status: "partial",
    summary: "The pool is live on Mezo's DEX and seeded with 20 jMEZO and 10 MUSD. The Earn page can swap against it, and the pool is excluded from jMEZO rewards.",
    limit: "The liquidity is ours and small, and its 0.50 MUSD price is a seed value. No one has swapped through it yet.",
    links: [
      { label: "Pool", kind: "address", value: POOL },
      { label: "Pool created", kind: "tx", value: "0xfb6ff1e0ee17444dbbff7bd5455f5434e45619e43cf2165a585c29f924811f0b" },
      { label: "Liquidity added", kind: "tx", value: "0x278b715b93a5675e7090a422afcd72fe67ea255df6468fd9d8377336a998d338" },
    ],
  },
  {
    id: "materials",
    ask: "Include a pitch deck, track, team roles and project status",
    status: "open",
    summary: "These go in the Wave 2 submission form.",
    limit: "Not submitted yet.",
    links: [],
  },
];

export function proofHref(link: ProofLink): string {
  if (link.kind === "code") return `${SITE.repoUrl}/blob/main/${link.value}`;
  if (link.kind === "mainnet") return `${SITE.mainnetExplorerUrl}/address/${link.value}`;
  return explorerUrl(link.kind, link.value);
}

export function statusCounts(items: readonly ProofItem[]): Record<ProofStatus, number> {
  return items.reduce((counts, item) => ({ ...counts, [item.status]: counts[item.status] + 1 }), { proven: 0, built: 0, partial: 0, open: 0 });
}
