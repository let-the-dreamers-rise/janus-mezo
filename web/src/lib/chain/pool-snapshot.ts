import { erc20Abi, parseAbi, zeroAddress, type Address, type PublicClient } from "viem";
import type { PoolReserves } from "@/lib/protocol/pool";
import { DEX_FACTORY, DEX_ROUTER, musdContract, vaultContract } from "./contracts";

export const dexRouterAbi = parseAbi([
  "struct Route { address from; address to; bool stable; address factory; }",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, Route[] routes, address to, uint256 deadline) returns (uint256[] amounts)",
  "function getAmountsOut(uint256 amountIn, Route[] routes) view returns (uint256[] amounts)",
]);

const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, bool stable) view returns (address)",
  "function getFee(address pool, bool stable) view returns (uint256)",
]);
const poolAbi = parseAbi([
  "function token0() view returns (address)",
  "function getReserves() view returns (uint256, uint256, uint256)",
]);

export interface PoolSnapshot extends PoolReserves {
  readonly address: Address;
  /// Router allowances of the connected account; zero with no account.
  readonly jmezoAllowance: bigint;
  readonly musdAllowance: bigint;
}

const factory = { address: DEX_FACTORY, abi: factoryAbi } as const;

/// The jMEZO/MUSD pool, or null until one exists.
export async function readPoolSnapshot(client: PublicClient, account: Address | undefined): Promise<PoolSnapshot | null> {
  const jmezo = vaultContract.address;
  const musd = musdContract.address;
  const address = await client.readContract({ ...factory, functionName: "getPool", args: [jmezo, musd, false] });
  if (address === zeroAddress) return null;
  const owner = account ?? zeroAddress;
  const [token0, reserves, feeBps, jmezoAllowance, musdAllowance] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address, abi: poolAbi, functionName: "token0" },
      { address, abi: poolAbi, functionName: "getReserves" },
      { ...factory, functionName: "getFee", args: [address, false] },
      { address: jmezo, abi: erc20Abi, functionName: "allowance", args: [owner, DEX_ROUTER] },
      { address: musd, abi: erc20Abi, functionName: "allowance", args: [owner, DEX_ROUTER] },
    ],
  });
  const jmezoFirst = token0.toLowerCase() === jmezo.toLowerCase();
  return {
    address,
    jmezo: jmezoFirst ? reserves[0] : reserves[1],
    musd: jmezoFirst ? reserves[1] : reserves[0],
    feeBps,
    jmezoAllowance,
    musdAllowance,
  };
}
