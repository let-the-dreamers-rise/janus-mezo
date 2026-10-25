import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { blockRanges, buildHistory, readRoundHistory } from "./round-history";

const ONE = 10n ** 18n;

describe("blockRanges", () => {
  it("splits a span into inclusive pages, newest first", () => {
    expect(blockRanges(100n, 125n, 10n)).toEqual([
      { fromBlock: 116n, toBlock: 125n },
      { fromBlock: 106n, toBlock: 115n },
      { fromBlock: 100n, toBlock: 105n },
    ]);
    expect(blockRanges(5n, 5n, 10n)).toEqual([{ fromBlock: 5n, toBlock: 5n }]);
    expect(blockRanges(9n, 5n, 10n)).toEqual([]);
  });
});

describe("buildHistory", () => {
  it("joins each round's start, settle and finalize, newest first", () => {
    const rows = buildHistory(
      [
        { roundId: 1n, epoch: 100n, shards: 3n, block: 10n },
        { roundId: 2n, epoch: 200n, shards: 1n, block: 50n },
      ],
      [{ roundId: 1n, supply: 100n * ONE, filled: 100n * ONE, orders: 2n }],
      [{ roundId: 1n, charged: 4n * ONE, toHolders: 36n * ONE / 10n, fee: 4n * ONE / 10n, block: 20n }],
    );
    expect(rows).toEqual([
      { roundId: 2n, epoch: 200n, shards: 1n, supply: undefined, filled: undefined, orders: undefined, charged: undefined, toHolders: undefined, finalized: false },
      {
        roundId: 1n,
        epoch: 100n,
        shards: 3n,
        supply: 100n * ONE,
        filled: 100n * ONE,
        orders: 2n,
        charged: 4n * ONE,
        toHolders: 36n * ONE / 10n,
        finalized: true,
      },
    ]);
  });
});

describe("readRoundHistory", () => {
  it("reads the three round events page by page from the deployment block", async () => {
    const pages: string[] = [];
    const logs: Record<string, unknown[]> = {
      RoundStarted: [{ args: { roundId: 1n, epoch: 100n, shards: 3n }, blockNumber: 10n }],
      RoundSettled: [{ args: { roundId: 1n, supply: 5n, filled: 5n, orders: 1n }, blockNumber: 11n }],
      RoundFinalized: [{ args: { roundId: 1n, charged: 2n, toHolders: 1n, fee: 1n }, blockNumber: 12n }],
    };
    const client = {
      getBlockNumber: async () => 25_000n,
      getContractEvents: async ({ eventName, fromBlock }: { eventName: string; fromBlock: bigint }) => {
        pages.push(`${eventName}@${fromBlock}`);
        return fromBlock === 0n ? logs[eventName] ?? [] : [];
      },
    } as unknown as PublicClient;
    const rows = await readRoundHistory(client, 0n);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ roundId: 1n, finalized: true, charged: 2n });
    expect(pages.filter((page) => page.startsWith("RoundStarted"))).toEqual([
      "RoundStarted@15001",
      "RoundStarted@5001",
      "RoundStarted@0",
    ]);
  });
});
