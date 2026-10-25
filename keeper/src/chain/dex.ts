import { encodeFunctionData, type Address, type PublicClient } from "viem";
import { dexRouterAbi } from "../abi/mezo.js";
import { MEZO_MATSNET } from "../config/addresses.js";
import { approveIfNeeded } from "./tokens.js";
import { sendTx, type Signer } from "./tx.js";

export type Route = readonly { from: Address; to: Address; stable: boolean; factory: Address }[];

export const hop = (from: Address, to: Address, stable = false) => ({
  from,
  to,
  stable,
  factory: MEZO_MATSNET.dexFactory,
});

export const ROUTES: Record<"musd" | "mezo", Route> = {
  musd: [hop(MEZO_MATSNET.btcToken, MEZO_MATSNET.musd)],
  mezo: [hop(MEZO_MATSNET.btcToken, MEZO_MATSNET.mezoToken)],
};

const router = { address: MEZO_MATSNET.dexRouter, abi: dexRouterAbi } as const;

/// The router's quote for a route, or null when a pool on it is missing or empty.
export async function quoteRoute(client: PublicClient, amountIn: bigint, route: Route): Promise<bigint | null> {
  try {
    const amounts = await client.readContract({ ...router, functionName: "getAmountsOut", args: [amountIn, route] });
    const out = amounts[amounts.length - 1] ?? 0n;
    return out > 0n ? out : null;
  } catch {
    return null;
  }
}

/// Swaps the signer's BTC along `route`, accepting up to 2% slippage. Returns the quote.
export async function swapBtc(signer: Signer, amountIn: bigint, route: Route, label: string): Promise<bigint> {
  const quoted = (await quoteRoute(signer.publicClient, amountIn, route)) ?? 0n;
  if (quoted === 0n) throw new Error(`The DEX quotes nothing for ${label}`);
  await approveIfNeeded(signer, MEZO_MATSNET.btcToken, MEZO_MATSNET.dexRouter, amountIn, "BTC for router");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const data = encodeFunctionData({
    abi: dexRouterAbi,
    functionName: "swapExactTokensForTokens",
    args: [amountIn, (quoted * 98n) / 100n, route, signer.walletClient.account.address, deadline],
  });
  await sendTx(signer, label, MEZO_MATSNET.dexRouter, data);
  return quoted;
}
