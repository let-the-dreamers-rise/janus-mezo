import { describe, expect, it } from "vitest";
import { BASE_BOOST, MAX_BOOST, additionalVotes, boostOf, ceilDiv, votesForBoost } from "./boost-math";

const E18 = 10n ** 18n;
// The Foundry fixture: 1M veMEZO voting power, 100 veBTC, so power p needs p * 10,000 votes for 5x.
const TOTAL = 1_000_000n * E18;
const BOOSTABLE_TOTAL = 100n * E18;

describe("boost math mirror", () => {
  it("matches the Solidity fixture's round numbers", () => {
    expect(votesForBoost(TOTAL, BOOSTABLE_TOTAL, E18, 5n * E18)).toBe(10_000n * E18);
    expect(votesForBoost(TOTAL, BOOSTABLE_TOTAL, 2n * E18, 3n * E18)).toBe(10_000n * E18);
    expect(boostOf(TOTAL, BOOSTABLE_TOTAL, E18, 10_000n * E18)).toBe(MAX_BOOST);
    expect(boostOf(TOTAL, BOOSTABLE_TOTAL, 2n * E18, 10_000n * E18)).toBe(3n * E18);
  });

  it("caps boost at 5x and floors it at 1x", () => {
    expect(boostOf(TOTAL, BOOSTABLE_TOTAL, E18, TOTAL)).toBe(MAX_BOOST);
    expect(boostOf(TOTAL, BOOSTABLE_TOTAL, E18, 0n)).toBe(BASE_BOOST);
    expect(boostOf(0n, BOOSTABLE_TOTAL, E18, 5n)).toBe(BASE_BOOST);
    expect(boostOf(TOTAL, BOOSTABLE_TOTAL, 0n, 5n)).toBe(BASE_BOOST);
  });

  it("returns the tightest vote count: one vote less misses the target", () => {
    let seed = 0x5eedn;
    const next = (mod: bigint) => {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n;
      return seed % mod;
    };
    for (let i = 0; i < 200; i++) {
      const total = next(10n ** 27n) + E18;
      const boostableTotal = next(10n ** 21n) + E18;
      const boostable = next(boostableTotal) + 1n;
      const target = BASE_BOOST + next(4n * E18) + 1n;
      const need = votesForBoost(total, boostableTotal, boostable, target);
      if (need === null) continue;
      expect(boostOf(total, boostableTotal, boostable, need) >= target).toBe(true);
      if (need > 0n) expect(boostOf(total, boostableTotal, boostable, need - 1n) < target).toBe(true);
    }
  });

  it("rejects what the contract rejects", () => {
    expect(votesForBoost(TOTAL, BOOSTABLE_TOTAL, E18, MAX_BOOST + 1n)).toBeNull();
    expect(votesForBoost(TOTAL, BOOSTABLE_TOTAL, 0n, 2n * E18)).toBeNull();
    expect(votesForBoost(0n, BOOSTABLE_TOTAL, E18, 2n * E18)).toBeNull();
    expect(votesForBoost(TOTAL, 0n, E18, 2n * E18)).toBeNull();
    expect(votesForBoost(TOTAL, BOOSTABLE_TOTAL, E18, BASE_BOOST)).toBe(0n);
  });

  it("subtracts votes the gauge already has", () => {
    expect(additionalVotes(TOTAL, BOOSTABLE_TOTAL, E18, 5n * E18, 4_000n * E18)).toBe(6_000n * E18);
    expect(additionalVotes(TOTAL, BOOSTABLE_TOTAL, E18, 5n * E18, 20_000n * E18)).toBe(0n);
    expect(additionalVotes(TOTAL, BOOSTABLE_TOTAL, 0n, 5n * E18, 0n)).toBeNull();
  });

  it("rounds division up like OpenZeppelin", () => {
    expect(ceilDiv(0n, 7n)).toBe(0n);
    expect(ceilDiv(7n, 7n)).toBe(1n);
    expect(ceilDiv(8n, 7n)).toBe(2n);
  });
});
