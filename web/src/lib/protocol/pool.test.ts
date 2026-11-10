import { describe, expect, it } from "vitest";
import { minReceived, priceOfJmezo, quoteSwap } from "./pool";

const E18 = 10n ** 18n;
const pool = { jmezo: 20n * E18, musd: 10n * E18, feeBps: 30n };

describe("quoteSwap", () => {
  it("takes the fee then follows the constant product when selling jMEZO", () => {
    const afterFee = E18 - (E18 * 30n) / 10_000n;
    expect(quoteSwap(pool, "sell", E18)).toBe((afterFee * pool.musd) / (pool.jmezo + afterFee));
  });

  it("quotes the other reserve when buying jMEZO", () => {
    const afterFee = E18 - (E18 * 30n) / 10_000n;
    expect(quoteSwap(pool, "buy", E18)).toBe((afterFee * pool.jmezo) / (pool.musd + afterFee));
  });

  it("returns zero for nothing in or an empty pool", () => {
    expect(quoteSwap(pool, "sell", 0n)).toBe(0n);
    expect(quoteSwap({ ...pool, jmezo: 0n }, "buy", E18)).toBe(0n);
  });
});

describe("priceOfJmezo", () => {
  it("is MUSD per jMEZO, scaled to 18 decimals", () => {
    expect(priceOfJmezo(pool)).toBe(E18 / 2n);
  });

  it("is null for an empty pool", () => {
    expect(priceOfJmezo({ ...pool, jmezo: 0n })).toBeNull();
  });
});

describe("minReceived", () => {
  it("takes off the slippage tolerance, rounding down", () => {
    expect(minReceived(999n, 100n)).toBe(989n);
  });
});
