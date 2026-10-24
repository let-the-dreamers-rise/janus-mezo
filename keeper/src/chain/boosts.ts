import type { PublicClient } from "viem";
import { boostMarketAbi } from "../abi/janus.js";
import { boostVoterAbi, votingEscrowAbi } from "../abi/mezo.js";
import { uniqueIds, type BoostRead } from "../lib/boosts.js";
import type { JanusContracts } from "./signals.js";

/// veBTC NFTs whose boost Janus moves: every active order's NFT, plus the NFTs filled in
/// the latest round and the one before, whose votes a newer round may have reset.
export async function boostCandidates(
  client: PublicClient,
  contracts: JanusContracts,
  latestRoundId: bigint,
): Promise<bigint[]> {
  const market = { address: contracts.market, abi: boostMarketAbi } as const;
  const rounds = [latestRoundId, latestRoundId - 1n].filter((id) => id > 0n);
  const [active, ...filled] = await Promise.all([
    client.readContract({ ...market, functionName: "activeOrderIds" }),
    ...rounds.map((id) => client.readContract({ ...market, functionName: "roundOrders", args: [id] })),
  ]);
  const orderIds = uniqueIds([...active, ...filled.flat()]);
  if (orderIds.length === 0) return [];
  const orders = await client.multicall({
    contracts: orderIds.map((id) => ({ ...market, functionName: "getOrder" as const, args: [id] as const })),
    allowFailure: false,
  });
  return uniqueIds(orders.map((order) => order.tokenId));
}

/// Applied and live boost of each NFT. NFTs whose reads fail, such as burned ones, are left out.
export async function readBoosts(
  client: PublicClient,
  contracts: JanusContracts,
  tokenIds: readonly bigint[],
): Promise<BoostRead[]> {
  if (tokenIds.length === 0) return [];
  const [locks, live] = await Promise.all([
    client.multicall({
      contracts: tokenIds.map((id) => ({
        address: contracts.veBtc,
        abi: votingEscrowAbi,
        functionName: "locked" as const,
        args: [id] as const,
      })),
    }),
    client.multicall({
      contracts: tokenIds.map((id) => ({
        address: contracts.boostVoter,
        abi: boostVoterAbi,
        functionName: "getBoost" as const,
        args: [id] as const,
      })),
    }),
  ]);
  return tokenIds.flatMap((tokenId, i) => {
    const lock = locks[i];
    const boost = live[i];
    if (lock?.status !== "success" || boost?.status !== "success") return [];
    return [{ tokenId, applied: lock.result.boost, live: boost.result }];
  });
}
