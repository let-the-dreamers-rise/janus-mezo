import { describe, expect, it } from "vitest";
import type { RoundRow } from "./round-history";
import { roundAnalytics } from "./round-analytics";

const ONE = 10n ** 18n;

const row = (over: Partial<RoundRow>): RoundRow => ({
  roundId: 1n,
  epoch: 0n,
  shards: 1n,
  supply: 200n * ONE,
  filled: 100n * ONE,
  orders: 1n,
  charged: 4n * ONE,
  toHolders: (36n * ONE) / 10n,
  finalized: true,
  ...over,
});

describe("roundAnalytics", () => {
  it("returns empty metrics before any round closes", () => {
    const a = roundAnalytics([]);
    expect(a.rounds).toBe(0);
    expect(a.fillRatePct).toBeNull();
    expect(a.avgPricePerVote).toBeNull();
    expect(a.holderIncomePer100Votes).toBeNull();
  });

  it("computes fill rate, price per vote and holder income over finalized rounds", () => {
    const a = roundAnalytics([row({}), row({ roundId: 2n, supply: 200n * ONE, filled: 100n * ONE, charged: 2n * ONE, toHolders: (18n * ONE) / 10n })]);
    expect(a.rounds).toBe(2);
    expect(a.fillRatePct).toBe(50);
    expect(a.avgPricePerVote).toBe((3n * ONE) / 100n);
    expect(a.toHolders).toBe((54n * ONE) / 10n);
    expect(a.holderIncomePer100Votes).toBe((135n * ONE) / 100n);
  });

  it("leaves rounds in progress out", () => {
    const a = roundAnalytics([row({}), row({ roundId: 2n, finalized: false, filled: 999n * ONE })]);
    expect(a.rounds).toBe(1);
    expect(a.votesSold).toBe(100n * ONE);
  });

  it("reports no price when nothing sold", () => {
    const a = roundAnalytics([row({ filled: 0n, charged: 0n, toHolders: 0n })]);
    expect(a.fillRatePct).toBe(0);
    expect(a.avgPricePerVote).toBeNull();
  });
});
