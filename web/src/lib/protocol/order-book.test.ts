import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { compareBids, hasDemand, projectFills, type BookEntry } from "./order-book";

const E18 = 10n ** 18n;
const TOTALS = { votingTotal: 1_000_000n * E18, boostableTotal: 100n * E18 };
const MIN = 10n ** 12n;
const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;

function entry(id: number, price: bigint, power: bigint, escrow = 100n * E18, extra: Partial<BookEntry> = {}): BookEntry {
  return {
    orderId: BigInt(id),
    owner: addr(id),
    tokenId: BigInt(100 + id),
    pricePerVote: price,
    targetBoost: 5n * E18,
    escrow,
    nftOwner: addr(id),
    gauge: addr(1000 + id),
    gaugeAlive: true,
    boostable: power,
    gaugeWeight: 0n,
    ...extra,
  };
}

describe("projectFills", () => {
  // Mirrors test_round_highestBidsWinScarceVotes: 60k votes, dave 50k at 3e15, bob 10k at
  // 2e15, carol 20k at 1e15.
  const dave = entry(1, 3n * 10n ** 15n, 5n * E18, 200n * E18);
  const bob = entry(2, 2n * 10n ** 15n, E18);
  const carol = entry(3, 10n ** 15n, 2n * E18);

  it("fills the highest bids first and runs out at the lowest", () => {
    const [first, second, third] = projectFills([carol, bob, dave], 60_000n * E18, TOTALS, MIN);
    expect(first?.entry.orderId).toBe(1n);
    expect(first?.status).toBe("full");
    expect(first?.cost).toBe(150n * E18);
    expect(second?.entry.orderId).toBe(2n);
    expect(second?.votes).toBe(10_000n * E18);
    expect(second?.boostAfter).toBe(5n * E18);
    expect(third?.status).toBe("unfilled");
    expect(third?.reason).toBe("No votes left at this price");
  });

  it("caps a fill by escrow and by the votes left", () => {
    const poor = entry(4, 2n * 10n ** 15n, E18, 10n * E18);
    const [byEscrow] = projectFills([poor], 60_000n * E18, TOTALS, MIN);
    expect(byEscrow?.status).toBe("partial");
    expect(byEscrow?.votes).toBe(5_000n * E18);
    expect(byEscrow?.reason).toBe("Limited by escrow");
    expect(byEscrow?.boostAfter).toBe(3n * E18);

    const [bySupply] = projectFills([carol], 10_000n * E18, TOTALS, MIN);
    expect(bySupply?.reason).toBe("Limited by votes for sale");
    expect(bySupply?.boostAfter).toBe(3n * E18);
  });

  it("counts votes the gauge already holds", () => {
    const helped = entry(5, 2n * 10n ** 15n, E18, 100n * E18, { gaugeWeight: 4_000n * E18 });
    expect(projectFills([helped], 60_000n * E18, TOTALS, MIN)[0]?.votes).toBe(6_000n * E18);
    const done = entry(6, 2n * 10n ** 15n, E18, 100n * E18, { gaugeWeight: 10_000n * E18 });
    expect(projectFills([done], 60_000n * E18, TOTALS, MIN)[0]?.status).toBe("at-target");
  });

  it("explains every bid the contract would skip", () => {
    const cases: Array<[Partial<BookEntry>, string]> = [
      [{ pricePerVote: MIN - 1n }, "Bid is below the market minimum"],
      [{ nftOwner: addr(999) }, "The veBTC NFT changed hands"],
      [{ nftOwner: undefined }, "The veBTC NFT changed hands"],
      [{ gauge: undefined }, "The boost gauge is missing or killed"],
      [{ gaugeAlive: false }, "The boost gauge is missing or killed"],
      [{ boostable: 0n }, "The veBTC lock has no voting power left"],
    ];
    for (const [patch, reason] of cases) {
      const [projection] = projectFills([entry(7, 2n * 10n ** 15n, E18, 100n * E18, patch)], 60_000n * E18, TOTALS, MIN);
      expect(projection?.status).toBe("ineligible");
      expect(projection?.reason).toBe(reason);
      expect(projection?.votes).toBe(0n);
    }
  });

  it("fills nothing without supply to price against", () => {
    const [projection] = projectFills([bob], 60_000n * E18, { votingTotal: 0n, boostableTotal: 0n }, MIN);
    expect(projection?.status).toBe("ineligible");
  });

  it("marks a used-up escrow, but fills any escrow that buys a fraction of a vote", () => {
    const [empty] = projectFills([entry(8, 2n * 10n ** 15n, E18, 0n)], 60_000n * E18, TOTALS, MIN);
    expect(empty?.status).toBe("unfilled");
    expect(empty?.reason).toBe("Escrow is used up");
    const [dust] = projectFills([entry(9, 2n * 10n ** 15n, E18, 1n)], 60_000n * E18, TOTALS, MIN);
    expect(dust?.votes).toBe(500n);
    expect(dust?.cost).toBe(1n);
  });
});

describe("hasDemand", () => {
  const supply = 60_000n * E18;

  it("is true when an eligible bid below its target can pay for votes", () => {
    expect(hasDemand(projectFills([entry(1, 2n * 10n ** 15n, E18)], supply, TOTALS, MIN))).toBe(true);
  });

  it("stays true when the bid only lacks votes for sale, as the keeper sees it", () => {
    expect(hasDemand(projectFills([entry(1, 2n * 10n ** 15n, E18)], 0n, TOTALS, MIN))).toBe(true);
  });

  it("is false for bids at target, out of escrow or ineligible", () => {
    const atTarget = entry(2, 2n * 10n ** 15n, E18, 100n * E18, { gaugeWeight: 10_000n * E18 });
    const broke = entry(3, 2n * 10n ** 15n, E18, 0n);
    const sold = entry(4, 2n * 10n ** 15n, E18, 100n * E18, { nftOwner: addr(999) });
    expect(hasDemand(projectFills([atTarget, broke, sold], supply, TOTALS, MIN))).toBe(false);
    expect(hasDemand([])).toBe(false);
  });
});

describe("compareBids", () => {
  it("orders by price, then by age", () => {
    const a = entry(2, 5n, E18);
    const b = entry(1, 5n, E18);
    const c = entry(3, 9n, E18);
    expect([a, b, c].sort(compareBids).map((x) => x.orderId)).toEqual([3n, 1n, 2n]);
    expect(compareBids(a, a)).toBe(0);
  });
});
