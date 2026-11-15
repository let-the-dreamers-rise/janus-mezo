import { SITE } from "@/config/site";

export interface FactLink {
  readonly label: string;
  readonly kind: "mainnet-tx" | "mainnet-address" | "matsnet-tx" | "matsnet-address" | "code";
  readonly value: string;
}

export interface Fact {
  readonly title: string;
  readonly detail: string;
  readonly links: readonly FactLink[];
}

export interface FactSection {
  readonly id: string;
  readonly title: string;
  readonly facts: readonly Fact[];
}

const MAINNET_EXPLORER = "https://explorer.mezo.org";
const MATSNET_EXPLORER = "https://explorer.test.mezo.org";

const MAINNET_VAULT = "0xDC1db035D17356Fc4aADd9cdB80F264512DA2879";
const MAINNET_MARKET = "0x9098b6f514f322A6f57501cdd92e7aBf79E41870";
const MATSNET_VAULT = "0xFbbCDfDE533f630b6d07D7FE3087eEa4c3A97a64";
const MATSNET_MARKET = "0xCE7f5e83372dFF1BCa16c2637F58f0fc1da5d72A";
const MATSNET_POOL = "0x99e93E6C1bcCbb4DA415B6B3e7E08661AbC45cD4";

/// Only facts that are true on chain or in the repo today. Work in progress belongs on the roadmap.
export const SECTIONS: readonly FactSection[] = [
  {
    id: "mainnet",
    title: "Live on Mezo mainnet",
    facts: [
      {
        title: "Both contracts deployed and verified",
        detail: "JanusVault (jMEZO) and BoostMarket launched on 15 November 2026, with source verified on the Mezo explorer.",
        links: [
          { label: "JanusVault", kind: "mainnet-address", value: MAINNET_VAULT },
          { label: "BoostMarket", kind: "mainnet-address", value: MAINNET_MARKET },
          { label: "Vault deploy", kind: "mainnet-tx", value: "0x9d91940610f7d16d1fac79118fce2b578df3c3977602ba24e9c9797b293adbbb" },
          { label: "Market deploy", kind: "mainnet-tx", value: "0xc561bdac14b7c455a671be420446acc7ad907be53baf69ad60062bbad4e59361" },
        ],
      },
      {
        title: "First veMEZO in the vault",
        detail: "veMEZO #2954 was deposited and made permanent, minting 100 jMEZO. Its 100 votes are for sale in the next round.",
        links: [{ label: "Deposit", kind: "mainnet-tx", value: "0xb4e67c680fca271e2f49dabb440becb97ee210b3ef329b4438d0e384a0f0bd61" }],
      },
      {
        title: "Ready to settle rounds",
        detail: "The fallback gauge is set, so every round can settle, and unsold votes never reach a buyer for free.",
        links: [{ label: "Fallback gauge set", kind: "mainnet-tx", value: "0xda28477d203763847b11f258af4b28b522f09078103ee00f36063ee27b4f6f77" }],
      },
    ],
  },
  {
    id: "rounds",
    title: "Rounds run end to end",
    facts: [
      {
        title: "Four full rounds on Matsnet",
        detail: "Two on v1 and two on v2. The first v2 round on 15 November filled 2 orders with 106.7 votes and charged 3.60 MUSD: 3.24 to jMEZO holders and 0.36 in fees.",
        links: [
          { label: "Round 1", kind: "matsnet-tx", value: "0x4fd93bf600eb8893d5d1a7ccc41439a0245b92ba254419fbd9c6bd6a2f7691ab" },
          { label: "Round 2", kind: "matsnet-tx", value: "0xcacac55587938e01302600ee0ef3fe141896e8ce38a6261fbab82cb59e0c54aa" },
          { label: "v2 round 1", kind: "matsnet-tx", value: "0x06729a99fb96542a637b0e11fa563c5a2b21e424f70a4f5834315be199bf5770" },
          { label: "v2 round 2", kind: "matsnet-tx", value: "0x6528a97805dd8dfb64446e742035360c6ae483d08dbd83646d8994f0fe7bc423" },
        ],
      },
      {
        title: "Rounds run on a schedule",
        detail: "A GitHub Actions job drives every round every 4 hours with a gas-only keeper wallet that owns nothing. Fill rate, price per vote and holder income are on the market page.",
        links: [{ label: "keeper.yml", kind: "code", value: ".github/workflows/keeper.yml" }],
      },
      {
        title: "Buyers pay only for boost that was applied",
        detail: "Every fill is poked on BoostVoter before it is charged. In the v2 round both veBTC boosts were applied, then charged.",
        links: [
          { label: "Boosts applied", kind: "matsnet-tx", value: "0x23ef326cab09b4affb1ed0dd802829ed519f931a7c0f2088349e119cc5a763f2" },
          { label: "BoostMarket.sol", kind: "code", value: "contracts/src/BoostMarket.sol" },
        ],
      },
    ],
  },
  {
    id: "product",
    title: "Product",
    facts: [
      {
        title: "jMEZO is one fungible token",
        detail: "Each jMEZO is a share of all MEZO in the vault, and any holder can redeem any shard at its current share.",
        links: [{ label: "jMEZO on Matsnet", kind: "matsnet-address", value: MATSNET_VAULT }],
      },
      {
        title: "Bribes flow to jMEZO holders",
        detail: "Anyone can call harvestBribes. Bribes a shard earns on BoostVoter stream to jMEZO holders over 7 days.",
        links: [{ label: "JanusVault.sol", kind: "code", value: "contracts/src/JanusVault.sol" }],
      },
      {
        title: "jMEZO/MUSD pool",
        detail: "A pool on Mezo's DEX makes jMEZO tradable without unlocking, with a swap on the Earn page. It is excluded from jMEZO rewards.",
        links: [{ label: "Pool on Matsnet", kind: "matsnet-address", value: MATSNET_POOL }],
      },
      {
        title: "veBTC autopilot",
        detail: "Turn it on once and the keeper re-locks your veBTC to the 28-day maximum every week, so its boost never decays. The contract has no owner and can only extend a lock.",
        links: [
          { label: "Autopilot on mainnet", kind: "mainnet-address", value: "0xfb68b13746d2487abE8499A1E2EA32b866114Bb0" },
          { label: "VeBtcAutopilot.sol", kind: "code", value: "contracts/src/autopilot/VeBtcAutopilot.sol" },
        ],
      },
      {
        title: "Free demo on Matsnet",
        detail: "The same app runs on testnet with a one-click wallet and a starter kit, so anyone can try every step for free.",
        links: [{ label: "Matsnet market", kind: "matsnet-address", value: MATSNET_MARKET }],
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    facts: [
      {
        title: "Internal security review",
        detail: "No critical or high findings. The medium findings are fixed or mitigated on chain. An independent audit comes before the cap rises.",
        links: [{ label: "SECURITY_REVIEW.md", kind: "code", value: "SECURITY_REVIEW.md" }],
      },
      {
        title: "Owner behind a 48-hour timelock",
        detail: "A TimelockController owns both mainnet contracts. Every fee, treasury, cap or market change waits 48 hours in public before it can run.",
        links: [
          { label: "Timelock", kind: "mainnet-address", value: "0x0DDb1419BA0DE9e11ABE52dFA93De7ce1Cf94510" },
          { label: "Handover", kind: "mainnet-tx", value: "0xa56c25ff18c29266e8128777e79174f60a7e48410eaacc2faad5f7649dec6947" },
        ],
      },
      {
        title: "Guard rails",
        detail: "1,000 MEZO deposit cap, 10 MEZO minimum shard, at most 100 shards and 32 open orders, and a fee hard-capped at 20%.",
        links: [{ label: "Minimum raised to 10 MEZO", kind: "mainnet-tx", value: "0xcfcf29b3b5b0a2d1d1f132d146055412a5c7d3b46c819d1f90b366b4a3bf07f5" }],
      },
      {
        title: "Tested",
        detail: "194 contract tests, a fork suite against real Mezo contracts, and 250+ app tests.",
        links: [{ label: "Tests", kind: "code", value: "contracts/test" }],
      },
    ],
  },
];

export function factHref(link: FactLink): string {
  switch (link.kind) {
    case "mainnet-tx":
      return `${MAINNET_EXPLORER}/tx/${link.value}`;
    case "mainnet-address":
      return `${MAINNET_EXPLORER}/address/${link.value}`;
    case "matsnet-tx":
      return `${MATSNET_EXPLORER}/tx/${link.value}`;
    case "matsnet-address":
      return `${MATSNET_EXPLORER}/address/${link.value}`;
    case "code":
      return `${SITE.repoUrl}/blob/main/${link.value}`;
  }
}
