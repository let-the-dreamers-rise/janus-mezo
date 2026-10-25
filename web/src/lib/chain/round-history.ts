import type { PublicClient } from "viem";
import { marketContract } from "./contracts";

/// Mezo's RPC serves logs for bounded block spans, so history is read in pages.
const PAGE_BLOCKS = 10_000n;

export interface BlockRange {
  readonly fromBlock: bigint;
  readonly toBlock: bigint;
}

export interface Started {
  readonly roundId: bigint;
  readonly epoch: bigint;
  readonly shards: bigint;
  readonly block: bigint;
}

export interface Settled {
  readonly roundId: bigint;
  readonly supply: bigint;
  readonly filled: bigint;
  readonly orders: bigint;
}

export interface Finalized {
  readonly roundId: bigint;
  readonly charged: bigint;
  readonly toHolders: bigint;
  readonly fee: bigint;
  readonly block: bigint;
}

export interface RoundRow {
  readonly roundId: bigint;
  readonly epoch: bigint;
  readonly shards: bigint;
  readonly supply: bigint | undefined;
  readonly filled: bigint | undefined;
  readonly orders: bigint | undefined;
  readonly charged: bigint | undefined;
  readonly toHolders: bigint | undefined;
  readonly finalized: boolean;
}

/// Inclusive pages from `from` to `to`, newest first.
export function blockRanges(from: bigint, to: bigint, size: bigint = PAGE_BLOCKS): readonly BlockRange[] {
  if (to < from) return [];
  const count = Number((to - from) / size) + 1;
  return Array.from({ length: count }, (_, i) => {
    const toBlock = to - BigInt(i) * size;
    const start = toBlock - size + 1n;
    return { fromBlock: start < from ? from : start, toBlock };
  });
}

/// One row per started round, newest first, with its settle and finalize numbers once known.
export function buildHistory(started: readonly Started[], settled: readonly Settled[], finalized: readonly Finalized[]): readonly RoundRow[] {
  const settledById = new Map(settled.map((event) => [event.roundId, event]));
  const finalizedById = new Map(finalized.map((event) => [event.roundId, event]));
  return [...started]
    .sort((a, b) => (a.roundId > b.roundId ? -1 : 1))
    .map((round) => {
      const settle = settledById.get(round.roundId);
      const close = finalizedById.get(round.roundId);
      return {
        roundId: round.roundId,
        epoch: round.epoch,
        shards: round.shards,
        supply: settle?.supply,
        filled: settle?.filled,
        orders: settle?.orders,
        charged: close?.charged,
        toHolders: close?.toHolders,
        finalized: close !== undefined,
      };
    });
}

interface EventLog {
  readonly args: Record<string, bigint>;
  readonly blockNumber: bigint;
}

async function eventsOf(client: PublicClient, eventName: string, ranges: readonly BlockRange[]): Promise<readonly EventLog[]> {
  const pages = await Promise.all(
    ranges.map((range) =>
      client.getContractEvents({ ...marketContract, eventName: eventName as "RoundStarted", ...range }) as unknown as Promise<EventLog[]>,
    ),
  );
  return pages.flat();
}

/// Every round since the market was deployed, from its RoundStarted, RoundSettled and
/// RoundFinalized events.
export async function readRoundHistory(client: PublicClient, deployedAtBlock: bigint): Promise<readonly RoundRow[]> {
  const latest = await client.getBlockNumber();
  const ranges = blockRanges(deployedAtBlock, latest);
  const [started, settled, finalized] = await Promise.all([
    eventsOf(client, "RoundStarted", ranges),
    eventsOf(client, "RoundSettled", ranges),
    eventsOf(client, "RoundFinalized", ranges),
  ]);
  const arg = (log: EventLog, name: string): bigint => log.args[name] ?? 0n;
  return buildHistory(
    started.map((log) => ({ roundId: arg(log, "roundId"), epoch: arg(log, "epoch"), shards: arg(log, "shards"), block: log.blockNumber })),
    settled.map((log) => ({ roundId: arg(log, "roundId"), supply: arg(log, "supply"), filled: arg(log, "filled"), orders: arg(log, "orders") })),
    finalized.map((log) => ({
      roundId: arg(log, "roundId"),
      charged: arg(log, "charged"),
      toHolders: arg(log, "toHolders"),
      fee: arg(log, "fee"),
      block: log.blockNumber,
    })),
  );
}
