import { zeroAddress, type Address, type PublicClient } from "viem";
import { staleBoosts } from "@/lib/protocol/keeper/boosts";
import { epochStart } from "@/lib/protocol/keeper/epochs";
import type { MarketSignals } from "@/lib/protocol/keeper/planner";
import { summarizeShards } from "@/lib/protocol/keeper/shards";
import { hasDemand, projectFills, type BookEntry, type MarketTotals, type Projection } from "@/lib/protocol/order-book";
import { marketContract, vaultContract, veBtcContract, veMezoContract, voterContract } from "./contracts";

export interface RoundView {
  readonly id: bigint;
  readonly epoch: bigint;
  readonly startedAt: bigint;
  readonly phase: number;
  readonly cursor: number;
  readonly fallbackGauge: Address;
  readonly supply: bigint;
  readonly filled: bigint;
}

export interface ShardView {
  readonly id: bigint;
  readonly amount: bigint;
  readonly power: bigint;
  readonly lastVoted: bigint;
  readonly usedWeights: bigint;
  /// Has not voted in the current epoch, so the next round can sell it.
  readonly eligible: boolean;
}

export interface RoundFill {
  readonly gauge: Address;
  readonly votes: bigint;
  readonly pricePerVote: bigint;
  readonly charged: bigint;
}

export interface OrderView extends BookEntry {
  /// Boost stored on the veBTC lock: what Mezo Earn uses until the next poke.
  readonly appliedBoost: bigint;
  /// BoostVoter.getBoost: what a poke would apply now.
  readonly liveBoost: bigint;
  /// This order's fill in the latest round, if it was filled.
  readonly lastFill: RoundFill | undefined;
}

export interface MarketSnapshot {
  readonly now: bigint;
  readonly blockNumber: bigint;
  readonly round: RoundView;
  readonly roundShardCount: number;
  readonly roundOrderIds: readonly bigint[];
  readonly roundTimeout: bigint;
  readonly minPricePerVote: bigint;
  readonly feeBps: bigint;
  readonly fallbackGauge: Address;
  readonly maxOrders: bigint;
  readonly totals: MarketTotals;
  readonly vault: {
    readonly supply: bigint;
    readonly totalRewards: bigint;
    readonly minShardAmount: bigint;
    readonly maxShards: bigint;
    readonly votingPower: bigint;
    readonly shards: readonly ShardView[];
  };
  readonly orders: readonly OrderView[];
  /// Votes a round started now could sell, and how they would be allocated.
  readonly projectedSupply: bigint;
  readonly projection: readonly Projection[];
  /// False when the vault's carried-over votes were too many to subtract exactly.
  readonly projectionExact: boolean;
  /// "this-epoch" projects a round started now. "next-epoch" means every shard already
  /// voted, so it projects the next epoch's round, which resets and resells all of them.
  readonly projectionScope: "this-epoch" | "next-epoch";
  /// What the keeper's planner reads to choose the next step.
  readonly signals: MarketSignals;
  /// Active orders' veBTC NFTs whose applied boost differs from the live one.
  readonly staleBoostIds: readonly bigint[];
}

const MAX_VOTE_READS = 1_500;
const orNone = (gauge: Address): Address | undefined => (gauge === zeroAddress ? undefined : gauge);

async function readShards(client: PublicClient, blockNumber: bigint, ids: readonly bigint[], now: bigint) {
  if (ids.length === 0) return [] as ShardView[];
  const at = { blockNumber, allowFailure: false } as const;
  const [amounts, powers, lastVoted, usedWeights] = await Promise.all([
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...vaultContract, functionName: "shardAmount" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...veMezoContract, functionName: "votingPowerOfNFT" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...voterContract, functionName: "lastVoted" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...voterContract, functionName: "usedWeights" as const, args: [id] as const })) }),
  ]);
  const start = epochStart(now);
  return ids.map((id, i) => {
    const voted = lastVoted[i] ?? 0n;
    return {
      id,
      amount: amounts[i] ?? 0n,
      power: powers[i] ?? 0n,
      lastVoted: voted,
      usedWeights: usedWeights[i] ?? 0n,
      eligible: voted < start,
    };
  });
}

async function readOrders(client: PublicClient, blockNumber: bigint, ids: readonly bigint[]) {
  if (ids.length === 0) return [];
  const at = { blockNumber, allowFailure: false } as const;
  const orders = await client.multicall({
    ...at,
    contracts: ids.map((id) => ({ ...marketContract, functionName: "getOrder" as const, args: [id] as const })),
  });
  const tokenIds = orders.map((order) => order.tokenId);
  const [owners, gauges, boostable, locks, liveBoosts] = await Promise.all([
    client.multicall({
      blockNumber,
      contracts: tokenIds.map((id) => ({ ...veBtcContract, functionName: "ownerOf" as const, args: [id] as const })),
    }),
    client.multicall({ ...at, contracts: tokenIds.map((id) => ({ ...voterContract, functionName: "boostableTokenIdToGauge" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: tokenIds.map((id) => ({ ...veBtcContract, functionName: "unboostedVotingPowerOfNFT" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: tokenIds.map((id) => ({ ...veBtcContract, functionName: "locked" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: tokenIds.map((id) => ({ ...voterContract, functionName: "getBoost" as const, args: [id] as const })) }),
  ]);
  const liveGauges = gauges.map(orNone);
  const [weights, alive] = await Promise.all([
    client.multicall({ ...at, contracts: gauges.map((gauge) => ({ ...voterContract, functionName: "weights" as const, args: [gauge] as const })) }),
    client.multicall({ ...at, contracts: gauges.map((gauge) => ({ ...voterContract, functionName: "isAlive" as const, args: [gauge] as const })) }),
  ]);
  return orders.map((order, i) => {
    const owner = owners[i];
    return {
      orderId: ids[i] ?? 0n,
      owner: order.owner,
      tokenId: order.tokenId,
      pricePerVote: order.pricePerVote,
      targetBoost: order.targetBoost,
      escrow: order.escrow,
      nftOwner: owner?.status === "success" ? owner.result : undefined,
      gauge: liveGauges[i],
      gaugeAlive: Boolean(liveGauges[i]) && Boolean(alive[i]),
      boostable: boostable[i] ?? 0n,
      gaugeWeight: weights[i] ?? 0n,
      appliedBoost: locks[i]?.boost ?? 0n,
      liveBoost: liveBoosts[i] ?? 0n,
    };
  });
}

async function readFills(client: PublicClient, blockNumber: bigint, roundId: bigint, orderIds: readonly bigint[]) {
  const fills = new Map<bigint, RoundFill>();
  if (roundId === 0n || orderIds.length === 0) return fills;
  const results = await client.multicall({
    blockNumber,
    allowFailure: false,
    contracts: orderIds.map((id) => ({ ...marketContract, functionName: "fills" as const, args: [roundId, id] as const })),
  });
  results.forEach(([gauge, votes, pricePerVote, charged], i) => {
    const id = orderIds[i];
    if (id !== undefined && votes > 0n) fills.set(id, { gauge, votes, pricePerVote, charged });
  });
  return fills;
}

/// The vault's own votes from an earlier epoch are reset before a round settles, so the
/// projection removes them from each buyer's gauge weight.
async function carriedVotes(
  client: PublicClient,
  blockNumber: bigint,
  resetting: readonly ShardView[],
  gauges: readonly Address[],
): Promise<{ byGauge: Map<string, bigint>; exact: boolean }> {
  const stale = resetting.filter((shard) => shard.usedWeights > 0n);
  const byGauge = new Map<string, bigint>();
  if (stale.length === 0 || gauges.length === 0) return { byGauge, exact: true };
  if (stale.length * gauges.length > MAX_VOTE_READS) return { byGauge, exact: false };
  const pairs = stale.flatMap((shard) => gauges.map((gauge) => ({ shard: shard.id, gauge })));
  const votes = await client.multicall({
    blockNumber,
    allowFailure: false,
    contracts: pairs.map(({ shard, gauge }) => ({ ...voterContract, functionName: "votes" as const, args: [shard, gauge] as const })),
  });
  pairs.forEach(({ gauge }, i) => {
    const key = gauge.toLowerCase();
    byGauge.set(key, (byGauge.get(key) ?? 0n) + (votes[i] ?? 0n));
  });
  return { byGauge, exact: true };
}

export async function readMarketSnapshot(client: PublicClient): Promise<MarketSnapshot> {
  const block = await client.getBlock();
  const blockNumber = block.number;
  const now = block.timestamp;
  const [current, orderIds, minPricePerVote, feeBps, fallbackGauge, roundTimeout, maxOrders, supply, shardIds, totalRewards, minShardAmount, maxShards, votingTotal, boostableTotal] =
    await client.multicall({
      blockNumber,
      allowFailure: false,
      contracts: [
        { ...marketContract, functionName: "currentRound" },
        { ...marketContract, functionName: "activeOrderIds" },
        { ...marketContract, functionName: "minPricePerVote" },
        { ...marketContract, functionName: "feeBps" },
        { ...marketContract, functionName: "fallbackGauge" },
        { ...marketContract, functionName: "ROUND_TIMEOUT" },
        { ...marketContract, functionName: "MAX_ACTIVE_ORDERS" },
        { ...vaultContract, functionName: "totalSupply" },
        { ...vaultContract, functionName: "shardIds" },
        { ...vaultContract, functionName: "totalRewards" },
        { ...vaultContract, functionName: "minShardAmount" },
        { ...vaultContract, functionName: "MAX_SHARDS" },
        { ...veMezoContract, functionName: "totalVotingPower" },
        { ...veBtcContract, functionName: "unboostedTotalVotingPower" },
      ],
    });
  const [roundId, info] = current;
  const round: RoundView = {
    id: roundId,
    epoch: BigInt(info.epoch),
    startedAt: BigInt(info.startedAt),
    phase: info.phase,
    cursor: info.cursor,
    fallbackGauge: info.fallbackGauge,
    supply: info.supply,
    filled: info.filled,
  };

  const none = Promise.resolve([] as readonly bigint[]);
  const [shards, orders, roundOrderIds, roundShards, roundPowers] = await Promise.all([
    readShards(client, blockNumber, shardIds, now),
    readOrders(client, blockNumber, orderIds),
    roundId > 0n ? client.readContract({ ...marketContract, functionName: "roundOrders", args: [roundId], blockNumber }) : none,
    roundId > 0n ? client.readContract({ ...marketContract, functionName: "roundShards", args: [roundId], blockNumber }) : none,
    roundId > 0n ? client.readContract({ ...marketContract, functionName: "roundPowers", args: [roundId], blockNumber }) : none,
  ]);
  const fills = await readFills(client, blockNumber, roundId, roundOrderIds);
  const totals = { votingTotal, boostableTotal };

  // The keeper's loop guard: shards this epoch's latest round already tried, with their power.
  const epoch = epochStart(now);
  const attempts = new Map(
    round.epoch === epoch ? roundPowers.map((power, i) => [roundShards[i] ?? 0n, power] as const) : [],
  );
  const shardSummary = summarizeShards(
    { ids: shards.map((s) => s.id), lastVoted: shards.map((s) => s.lastVoted), usedWeights: shards.map((s) => s.usedWeights) },
    epoch,
    attempts,
  );

  // A round started now sells the eligible shards. Once every shard has voted, the next
  // round is next epoch's, which resets and resells all of them.
  const projectionScope = !shardSummary.eligible && shards.length > 0 ? "next-epoch" : "this-epoch";
  const selling = projectionScope === "next-epoch" ? shards : shards.filter((shard) => shard.eligible);
  const gauges = [...new Set(orders.flatMap((order) => (order.gauge ? [order.gauge] : [])))];
  const carried = await carriedVotes(client, blockNumber, selling, gauges);

  const entries: BookEntry[] = orders.map((order) => {
    const held = order.gauge ? carried.byGauge.get(order.gauge.toLowerCase()) ?? 0n : 0n;
    return { ...order, gaugeWeight: order.gaugeWeight > held ? order.gaugeWeight - held : 0n };
  });
  const projectedSupply = selling.reduce((sum, shard) => sum + shard.power, 0n);
  const projection = projectFills(entries, projectedSupply, totals, minPricePerVote);
  const signals: MarketSignals = {
    hasEligibleShards: shardSummary.eligible,
    hasStaleVotes: shardSummary.stale,
    hasDemand: hasDemand(projection),
    roundTimeout,
  };
  const staleBoostIds = staleBoosts(
    orders.map((order) => ({ tokenId: order.tokenId, applied: order.appliedBoost, live: order.liveBoost })),
  );

  return {
    now,
    blockNumber,
    round,
    roundShardCount: roundShards.length,
    roundOrderIds,
    roundTimeout,
    minPricePerVote,
    feeBps,
    fallbackGauge,
    maxOrders,
    totals,
    vault: {
      supply,
      totalRewards,
      minShardAmount,
      maxShards,
      votingPower: shards.reduce((sum, shard) => sum + shard.power, 0n),
      shards,
    },
    orders: orders.map((order) => ({ ...order, lastFill: fills.get(order.orderId) })),
    projectedSupply,
    projection,
    projectionExact: carried.exact,
    projectionScope,
    signals,
    staleBoostIds,
  };
}
