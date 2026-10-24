import { describe, expect, it } from "vitest";
import {
  affordableVotes,
  costOfVotes,
  parseDecimal,
  pricePerVoteFromQuote,
  quoteFromPricePerVote,
  toNumber,
  toRaw,
} from "./units";

const E18 = 10n ** 18n;

describe("parseDecimal", () => {
  it("accepts plain decimals", () => {
    expect(parseDecimal("1")).toBe(E18);
    expect(parseDecimal("0.5")).toBe(E18 / 2n);
    expect(parseDecimal(".25")).toBe(E18 / 4n);
    expect(parseDecimal("12.")).toBe(12n * E18);
    expect(parseDecimal(" 3 ")).toBe(3n * E18);
    expect(parseDecimal("0.00000001", 8)).toBe(1n);
  });

  it("rejects anything a person should be told to fix", () => {
    for (const bad of ["", ".", "-1", "1e5", "1,000", "0x10", "1.2.3", "abc"]) {
      expect(parseDecimal(bad)).toBeNull();
    }
    expect(parseDecimal("0.000000001", 8)).toBeNull();
  });
});

describe("pricing", () => {
  it("converts between per-1k quotes and the contract's per-vote price", () => {
    expect(pricePerVoteFromQuote(E18)).toBe(10n ** 15n);
    expect(quoteFromPricePerVote(10n ** 15n)).toBe(E18);
  });

  it("charges like the contract: rounded up", () => {
    expect(costOfVotes(10_000n * E18, 2n * 10n ** 15n)).toBe(20n * E18);
    expect(costOfVotes(1n, 1n)).toBe(1n);
    expect(costOfVotes(0n, 10n ** 15n)).toBe(0n);
  });

  it("counts the votes an escrow can pay for", () => {
    expect(affordableVotes(20n * E18, 2n * 10n ** 15n)).toBe(10_000n * E18);
    expect(affordableVotes(20n * E18, 0n)).toBe(0n);
  });

  it("converts to display numbers and raw strings", () => {
    expect(toNumber(1_500_000_000_000_000_000n)).toBe(1.5);
    expect(toRaw(1n)).toBe("0.000000000000000001");
  });
});
