import { defineChain } from "viem";

export const MATSNET_CHAIN_ID = 31611;
export const MATSNET_RPC_URL = "https://rpc.test.mezo.org";
export const MATSNET_EXPLORER_URL = "https://explorer.test.mezo.org";

export const mezoMatsnet = defineChain({
  id: MATSNET_CHAIN_ID,
  name: "Mezo Matsnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [MATSNET_RPC_URL] } },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: MATSNET_EXPLORER_URL },
  },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: true,
});
