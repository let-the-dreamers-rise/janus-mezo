import { describe, expect, it } from "vitest";
import { chunks, fitBatch } from "../src/lib/batch.js";

describe("chunks", () => {
  it("splits into consecutive groups of at most the given size", () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([1, 2], 5)).toEqual([[1, 2]]);
    expect(chunks([], 3)).toEqual([]);
  });

  it("rejects a size that is not a positive integer", () => {
    expect(() => chunks([1], 0)).toThrow(/positive integer/);
    expect(() => chunks([1], 1.5)).toThrow(/positive integer/);
  });
});

describe("fitBatch", () => {
  const perShard = (gas: bigint) => async (size: bigint) => size * gas;

  it("keeps the starting size when it fits the budget", async () => {
    expect(await fitBatch(10n, 8_000_000n, perShard(500_000n))).toEqual({ size: 10n, gas: 5_000_000n });
  });

  it("halves until the estimate fits", async () => {
    expect(await fitBatch(10n, 8_000_000n, perShard(3_000_000n))).toEqual({ size: 2n, gas: 6_000_000n });
  });

  it("treats a failed estimate as too large and keeps halving", async () => {
    const failsAboveThree = async (size: bigint) => (size > 3n ? null : size * 1_000_000n);
    expect(await fitBatch(16n, 8_000_000n, failsAboveThree)).toEqual({ size: 2n, gas: 2_000_000n });
  });

  it("returns null when even one item does not fit", async () => {
    expect(await fitBatch(4n, 8_000_000n, perShard(9_000_000n))).toBeNull();
    expect(await fitBatch(4n, 8_000_000n, async () => null)).toBeNull();
  });

  it("rejects a starting size below one", async () => {
    await expect(fitBatch(0n, 8_000_000n, perShard(1n))).rejects.toThrow(/at least 1/);
  });
});
