import { describe, expect, it } from "vitest";
import { staleBoosts, uniqueIds } from "../src/lib/boosts.js";

const ONE = 10n ** 18n;

describe("staleBoosts", () => {
  it("picks NFTs whose applied boost differs from what a poke would apply", () => {
    const reads = [
      { tokenId: 1n, applied: ONE, live: 5n * ONE },
      { tokenId: 2n, applied: 5n * ONE, live: 5n * ONE },
      { tokenId: 3n, applied: 5n * ONE, live: ONE },
    ];
    expect(staleBoosts(reads)).toEqual([1n, 3n]);
  });

  it("treats a never-poked NFT as unboosted", () => {
    expect(staleBoosts([{ tokenId: 7n, applied: 0n, live: ONE }])).toEqual([]);
    expect(staleBoosts([{ tokenId: 7n, applied: 0n, live: 2n * ONE }])).toEqual([7n]);
  });

  it("ignores drift from decaying voting power below 0.01x", () => {
    const partial = 2_816_684_217_435_151_067n;
    expect(staleBoosts([{ tokenId: 5n, applied: partial, live: partial + 9n * 10n ** 15n }])).toEqual([]);
    expect(staleBoosts([{ tokenId: 5n, applied: partial, live: partial - 2n * 10n ** 16n }])).toEqual([5n]);
  });

  it("lists each NFT once", () => {
    const read = { tokenId: 4n, applied: ONE, live: 3n * ONE };
    expect(staleBoosts([read, read])).toEqual([4n]);
  });
});

describe("uniqueIds", () => {
  it("drops zeros and duplicates and keeps first-seen order", () => {
    expect(uniqueIds([3n, 0n, 1n, 3n, 2n, 1n])).toEqual([3n, 1n, 2n]);
  });
});
