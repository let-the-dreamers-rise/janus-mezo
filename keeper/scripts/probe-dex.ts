/// Read-only probe: Mezo DEX liquidity for BTC/MUSD, Multicall3 availability and lock limits.
/// Usage: pnpm exec tsx scripts/probe-dex.ts
import { createPublicClient, formatEther, http, parseAbi, parseEther, type Address } from "viem";
import { MEZO_MATSNET } from "../src/config/addresses.js";
import { mezoMatsnet } from "../src/config/chain.js";

const ROUTER: Address = "0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9";
const MULTICALL3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

const routerAbi = parseAbi([
  "function defaultFactory() view returns (address)",
  "function poolFor(address tokenA, address tokenB, bool stable, address factory) view returns (address)",
  "function getReserves(address tokenA, address tokenB, bool stable, address factory) view returns (uint256 reserveA, uint256 reserveB)",
  "struct Route { address from; address to; bool stable; address factory; }",
  "function getAmountsOut(uint256 amountIn, Route[] routes) view returns (uint256[] amounts)",
]);
const escrowAbi = parseAbi(["function maxLockTime() view returns (uint256)"]);

const client = createPublicClient({ chain: mezoMatsnet, transport: http() });
const settle = <T>(p: Promise<T>): Promise<T | string> =>
  p.catch((e: Error) => `ERR ${e.message.split("\n")[0]}`);

async function main(): Promise<void> {
  const router = { address: ROUTER, abi: routerAbi } as const;
  const factory = await client.readContract({ ...router, functionName: "defaultFactory" });
  const btc = MEZO_MATSNET.btcToken;
  const musd = MEZO_MATSNET.musd;

  for (const stable of [false, true]) {
    const pool = await settle(client.readContract({ ...router, functionName: "poolFor", args: [btc, musd, stable, factory] }));
    const reserves = await settle(client.readContract({ ...router, functionName: "getReserves", args: [btc, musd, stable, factory] }));
    const quotes: Record<string, string> = {};
    for (const btcIn of ["0.0001", "0.001", "0.005"]) {
      const out = await settle(
        client.readContract({
          ...router,
          functionName: "getAmountsOut",
          args: [parseEther(btcIn), [{ from: btc, to: musd, stable, factory }]],
        }),
      );
      quotes[`${btcIn} BTC`] = typeof out === "string" ? out : `${formatEther(out[out.length - 1] ?? 0n)} MUSD`;
    }
    console.log({
      stable,
      pool,
      reserves: typeof reserves === "string" ? reserves : reserves.map((r) => formatEther(r)),
      quotes,
    });
  }

  const [multicallCode, veBtcMax, veMezoMax] = await Promise.all([
    client.getCode({ address: MULTICALL3 }),
    settle(client.readContract({ address: MEZO_MATSNET.veBtc, abi: escrowAbi, functionName: "maxLockTime" })),
    settle(client.readContract({ address: MEZO_MATSNET.veMezo, abi: escrowAbi, functionName: "maxLockTime" })),
  ]);
  const days = (v: bigint | string) => (typeof v === "string" ? v : `${Number(v) / 86400} days`);
  console.log({
    factory,
    multicall3Deployed: Boolean(multicallCode && multicallCode !== "0x"),
    veBtcMaxLock: days(veBtcMax),
    veMezoMaxLock: days(veMezoMax),
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
