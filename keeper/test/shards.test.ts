import { describe, expect, it } from "vitest";
import { summarizeShards } from "../src/lib/shards.js";

const EPOCH = 1_792_627_200n;
const LAST_WEEK = EPOCH - 7n * 86_400n;
const none = new Map<bigint, bigint>();

describe("summarizeShards", () => {
  it("marks shards that have not voted this epoch as eligible", () => {
    const reads = { ids: [1n, 2n], lastVoted: [EPOCH + 10n, LAST_WEEK], usedWeights: [5n, 0n] };
    expect(summarizeShards(reads, EPOCH, none)).toEqual({ eligible: true, stale: false });
  });

  it("flags an eligible shard that still carries last epoch's votes", () => {
    const reads = { ids: [1n], lastVoted: [LAST_WEEK], usedWeights: [5n] };
    expect(summarizeShards(reads, EPOCH, none)).toEqual({ eligible: true, stale: true });
  });

  it("ignores shards that already voted this epoch", () => {
    const reads = { ids: [1n], lastVoted: [EPOCH + 3_600n], usedWeights: [5n] };
    expect(summarizeShards(reads, EPOCH, none)).toEqual({ eligible: false, stale: false });
  });

  it("does not loop on a shard this epoch's round already tried and could not sell", () => {
    const reads = { ids: [1n], lastVoted: [LAST_WEEK], usedWeights: [5n] };
    const tried = new Map([[1n, 0n]]);
    expect(summarizeShards(reads, EPOCH, tried)).toEqual({ eligible: false, stale: false });
  });

  it("keeps a shard that abstained with power for new demand later in the epoch", () => {
    const reads = { ids: [1n], lastVoted: [LAST_WEEK], usedWeights: [0n] };
    const abstained = new Map([[1n, 30_000n]]);
    expect(summarizeShards(reads, EPOCH, abstained)).toEqual({ eligible: true, stale: false });
  });

  it("handles an empty vault", () => {
    expect(summarizeShards({ ids: [], lastVoted: [], usedWeights: [] }, EPOCH, none)).toEqual({
      eligible: false,
      stale: false,
    });
  });
});
