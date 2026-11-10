import { describe, expect, it } from "vitest";
import { selectNetwork } from "../src/config/networks.js";
import { minOut } from "../src/lib/pool.js";

describe("selectNetwork", () => {
  it("defaults to matsnet", () => {
    expect(selectNetwork(undefined).chain.id).toBe(31611);
    expect(selectNetwork("").chain.id).toBe(31611);
  });

  it("selects mainnet only when named", () => {
    const mainnet = selectNetwork("mainnet");
    expect(mainnet.chain.id).toBe(31612);
    expect(mainnet.dexRouter).toBe("0x16A76d3cd3C1e3CE843C6680d6B37E9116b5C706");
  });

  it("refuses an unknown network instead of falling back", () => {
    expect(() => selectNetwork("mainet")).toThrow(/JANUS_NETWORK/);
  });
});

describe("minOut", () => {
  it("takes the slippage off and rounds down", () => {
    expect(minOut(1_000n, 100n)).toBe(990n);
    expect(minOut(999n, 100n)).toBe(989n);
  });

  it("rejects slippage outside 0 to 100 percent", () => {
    expect(() => minOut(1n, 10_001n)).toThrow(/slippage/);
    expect(() => minOut(1n, -1n)).toThrow(/slippage/);
  });
});
