import { defineChain } from "viem";

/// Mezo Matsnet for server code and tests. The browser uses OrangeKit's chain, which loads
/// wallet code a server route has no use for.
export const matsnet = defineChain({
  id: 31_611,
  name: "Mezo Matsnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});
