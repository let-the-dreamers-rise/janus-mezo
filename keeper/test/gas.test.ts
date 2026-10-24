import { describe, expect, it } from "vitest";
import { BLOCK_GAS_LIMIT, MAX_TX_GAS, gasWithHeadroom, likelyOutOfGas } from "../src/lib/gas.js";

describe("gasWithHeadroom", () => {
  it("adds half again to the estimate", () => {
    expect(gasWithHeadroom(545_366n)).toBe(818_049n);
  });

  it("never asks for more than fits a block", () => {
    expect(gasWithHeadroom(9_000_000n)).toBe(MAX_TX_GAS);
    expect(MAX_TX_GAS < BLOCK_GAS_LIMIT).toBe(true);
  });

  it("respects a custom cap", () => {
    expect(gasWithHeadroom(1_000_000n, 1_200_000n)).toBe(1_200_000n);
  });
});

describe("likelyOutOfGas", () => {
  it("flags a revert that used the whole limit", () => {
    expect(likelyOutOfGas(31_596n, 31_596n)).toBe(true);
  });

  it("flags a revert that kept back only the 1/64 an inner call leaves", () => {
    expect(likelyOutOfGas(510_642n, 545_365n)).toBe(true);
  });

  it("does not flag a revert that stopped well short of the limit", () => {
    expect(likelyOutOfGas(120_000n, 545_365n)).toBe(false);
  });

  it("treats the cap as the last resort, since padding it changes nothing", () => {
    expect(likelyOutOfGas(MAX_TX_GAS, MAX_TX_GAS)).toBe(true);
    expect(gasWithHeadroom(MAX_TX_GAS) === MAX_TX_GAS).toBe(true);
  });
});
