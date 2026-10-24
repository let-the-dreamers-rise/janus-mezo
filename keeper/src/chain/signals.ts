import type { Address, PublicClient } from "viem";
import { boostMarketAbi, janusVaultAbi } from "../abi/janus.js";
import { boostVoterAbi, votingEscrowAbi } from "../abi/mezo.js";
import { epochStart } from "../lib/epochs.js";
import type { RoundView } from "../lib/planner.js";
import { summarizeShards, type ShardSignals } from "../lib/shards.js";

export type { ShardSignals } from "../lib/shards.js";

export interface JanusContracts {
  readonly vault: Address;
  readonly market: Address;
  readonly boostVoter: Address;
  readonly veBtc: Address;
}

const VOTE_UNIT = 10n ** 18n;

export async function chainTime(client: PublicClient): Promise<bigint> {
  const block = await client.getBlock();
  return block.timestamp;
}

export async function readRound(
  client: PublicClient,
  contracts: JanusContracts,
): Promise<{ id: bigint; round: RoundView }> {
  const [id, info] = await client.readContract({
    address: contracts.market,
    abi: boostMarketAbi,
    functionName: "currentRound",
  });
  return { id, round: { phase: info.phase, epoch: info.epoch, startedAt: info.startedAt } };
}

export async function readRoundTimeout(client: PublicClient, contracts: JanusContracts): Promise<bigint> {
  return client.readContract({ address: contracts.market, abi: boostMarketAbi, functionName: "ROUND_TIMEOUT" });
}

/// Shards the latest round snapshotted, mapped to the power it recorded, when that round
/// belongs to the epoch starting at `epoch`. Empty otherwise.
async function roundAttempts(
  client: PublicClient,
  contracts: JanusContracts,
  latest: { id: bigint; round: RoundView },
  epoch: bigint,
): Promise<Map<bigint, bigint>> {
  if (latest.id === 0n || latest.round.epoch !== epoch) return new Map();
  const market = { address: contracts.market, abi: boostMarketAbi } as const;
  const [shards, powers] = await Promise.all([
    client.readContract({ ...market, functionName: "roundShards", args: [latest.id] }),
    client.readContract({ ...market, functionName: "roundPowers", args: [latest.id] }),
  ]);
  return new Map(powers.map((power, i) => [shards[i] ?? 0n, power] as const));
}

export async function shardSignals(
  client: PublicClient,
  contracts: JanusContracts,
  now: bigint,
  latest: { id: bigint; round: RoundView },
): Promise<ShardSignals> {
  const ids = await client.readContract({ address: contracts.vault, abi: janusVaultAbi, functionName: "shardIds" });
  if (ids.length === 0) return { eligible: false, stale: false };
  const voter = { address: contracts.boostVoter, abi: boostVoterAbi } as const;
  const epoch = epochStart(now);
  const [lastVoted, usedWeights, attempts] = await Promise.all([
    client.multicall({
      contracts: ids.map((id) => ({ ...voter, functionName: "lastVoted" as const, args: [id] as const })),
      allowFailure: false,
    }),
    client.multicall({
      contracts: ids.map((id) => ({ ...voter, functionName: "usedWeights" as const, args: [id] as const })),
      allowFailure: false,
    }),
    roundAttempts(client, contracts, latest, epoch),
  ]);
  return summarizeShards({ ids, lastVoted, usedWeights }, epoch, attempts);
}

/// Active orders that BoostMarket.settle would fill right now. Mirrors the eligibility
/// rules in BoostMarket._fillFor, so the keeper never starts a round that sells nothing.
export async function demandingOrders(client: PublicClient, contracts: JanusContracts): Promise<bigint[]> {
  const market = { address: contracts.market, abi: boostMarketAbi } as const;
  const [ids, minPrice] = await Promise.all([
    client.readContract({ ...market, functionName: "activeOrderIds" }),
    client.readContract({ ...market, functionName: "minPricePerVote" }),
  ]);
  if (ids.length === 0) return [];

  const orders = await client.multicall({
    contracts: ids.map((id) => ({ ...market, functionName: "getOrder" as const, args: [id] as const })),
    allowFailure: false,
  });
  const [owners, needs, gauges] = await Promise.all([
    client.multicall({
      contracts: orders.map((order) => ({
        address: contracts.veBtc,
        abi: votingEscrowAbi,
        functionName: "ownerOf" as const,
        args: [order.tokenId] as const,
      })),
    }),
    client.multicall({
      contracts: orders.map((order) => ({
        ...market,
        functionName: "quoteVotes" as const,
        args: [order.tokenId, order.targetBoost] as const,
      })),
    }),
    client.multicall({
      contracts: orders.map((order) => ({
        address: contracts.boostVoter,
        abi: boostVoterAbi,
        functionName: "boostableTokenIdToGauge" as const,
        args: [order.tokenId] as const,
      })),
      allowFailure: false,
    }),
  ]);
  const alive = await client.multicall({
    contracts: gauges.map((gauge) => ({
      address: contracts.boostVoter,
      abi: boostVoterAbi,
      functionName: "isAlive" as const,
      args: [gauge] as const,
    })),
    allowFailure: false,
  });

  return ids.filter((_, i) => {
    const order = orders[i];
    const owner = owners[i];
    const need = needs[i];
    if (!order || owner?.status !== "success" || need?.status !== "success") return false;
    if (owner.result.toLowerCase() !== order.owner.toLowerCase()) return false;
    if (!alive[i] || order.pricePerVote < minPrice || order.pricePerVote === 0n) return false;
    const affordable = (order.escrow * VOTE_UNIT) / order.pricePerVote;
    return need.result > 0n && affordable > 0n;
  });
}
