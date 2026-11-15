import { defineChain, type Address, type Chain } from "viem";
import { MEZO_MAINNET, MEZO_MATSNET } from "./addresses.js";
import { mezoMatsnet } from "./chain.js";

export const mezoMainnet = defineChain({
  id: 31612,
  name: "Mezo",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-http.mezo.boar.network"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.mezo.org" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export interface Network {
  readonly chain: Chain;
  readonly dexRouter: Address;
}

const NETWORKS: Readonly<Record<string, Network>> = {
  matsnet: { chain: mezoMatsnet, dexRouter: MEZO_MATSNET.dexRouter },
  mainnet: { chain: mezoMainnet, dexRouter: MEZO_MAINNET.dexRouter },
};

/// Picks the network from JANUS_NETWORK. A typo must fail rather than fall back, so a
/// command meant for one network can never run against the other.
export function selectNetwork(name: string | undefined): Network {
  const network = NETWORKS[name === undefined || name === "" ? "matsnet" : name];
  if (!network) throw new Error(`JANUS_NETWORK must be one of ${Object.keys(NETWORKS).join(", ")}`);
  return network;
}
