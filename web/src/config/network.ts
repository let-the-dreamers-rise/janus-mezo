export type JanusNetwork = "matsnet" | "mainnet";

export interface NetworkInfo {
  readonly chainId: number;
  readonly label: string;
  readonly explorerUrl: string;
  /// The one-click demo wallet and free starter kit exist only where the money is fake.
  readonly demoEnabled: boolean;
  /// The same app on the other network: mainnet points to the free demo, the demo to mainnet.
  readonly twin: { readonly url: string; readonly label: string };
}

const MAINNET_SITE = "https://janus-mezo.vercel.app";
const TESTNET_SITE = "https://janus-mezo-testnet.vercel.app";

const INFO: Readonly<Record<JanusNetwork, NetworkInfo>> = {
  matsnet: { chainId: 31611, label: "Mezo Matsnet", explorerUrl: "https://explorer.test.mezo.org", demoEnabled: true, twin: { url: MAINNET_SITE, label: "Live on mainnet" } },
  mainnet: { chainId: 31612, label: "Mezo Mainnet", explorerUrl: "https://explorer.mezo.org", demoEnabled: false, twin: { url: TESTNET_SITE, label: "Try the free testnet demo" } },
};

/// A typo must fail the build rather than ship the site pointed at the wrong network.
export function parseNetwork(value: string | undefined): JanusNetwork {
  if (value === undefined || value === "") return "matsnet";
  if (value === "matsnet" || value === "mainnet") return value;
  throw new Error("NEXT_PUBLIC_JANUS_NETWORK must be matsnet or mainnet");
}

export const networkInfo = (network: JanusNetwork): NetworkInfo => INFO[network];

export const NETWORK = parseNetwork(process.env.NEXT_PUBLIC_JANUS_NETWORK);
export const NETWORK_INFO = networkInfo(NETWORK);
export const IS_MAINNET = NETWORK === "mainnet";
