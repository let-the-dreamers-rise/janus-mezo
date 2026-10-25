import { describe, expect, it } from "vitest";
import { quickBids } from "./bid";

describe("quickBids", () => {
  const MIN = 10n ** 12n;

  it("offers matching and outbidding the top of the book, rounded up", () => {
    expect(quickBids(5n * 10n ** 16n, MIN)).toEqual([
      { label: "Match the top", pricePerVote: 5n * 10n ** 16n },
      { label: "Top +10%", pricePerVote: 55n * 10n ** 15n },
      { label: "Top +25%", pricePerVote: 625n * 10n ** 14n },
    ]);
    expect(quickBids(3n, MIN).every((pick) => pick.pricePerVote >= MIN)).toBe(true);
  });

  it("offers nothing when the book is empty", () => {
    expect(quickBids(0n, MIN)).toEqual([]);
  });
});
import type { Address } from "viem";
import { checkAmount, checkQuote, describeFill, previewBid, roundsCovered, suggestedEscrow, targetFromHundredths } from "./bid";
import type { BookEntry } from "./order-book";

const E18 = 10n ** 18n;
const TOTALS = { votingTotal: 1_000_000n * E18, boostableTotal: 100n * E18 };
const MIN = 10n ** 12n;
const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;

function entry(id: number, price: bigint, power: bigint): BookEntry {
  return {
    orderId: BigInt(id),
    owner: addr(id),
    tokenId: BigInt(100 + id),
    pricePerVote: price,
    targetBoost: 5n * E18,
    escrow: 1_000n * E18,
    nftOwner: addr(id),
    gauge: addr(1000 + id),
    gaugeAlive: true,
    boostable: power,
    gaugeWeight: 0n,
  };
}

describe("checkQuote", () => {
  it("turns MUSD per 1,000 votes into the contract's price per vote", () => {
    expect(checkQuote("50", MIN)).toEqual({ ok: true, value: 5n * 10n ** 16n });
  });

  it("rejects empty, malformed and below-minimum bids with a reason", () => {
    expect(checkQuote("", MIN)).toEqual({ ok: false, message: "Enter a bid in MUSD per 1,000 votes." });
    expect(checkQuote("1e3", MIN).ok).toBe(false);
    expect(checkQuote("0.0001", MIN)).toEqual({ ok: false, message: "Bids start at 0.001 MUSD per 1,000 votes." });
  });
});

describe("checkAmount", () => {
  it("accepts an amount the account holds", () => {
    expect(checkAmount("5.25", 10n * E18)).toEqual({ ok: true, value: 525n * 10n ** 16n });
  });

  it("rejects zero and more than the balance", () => {
    expect(checkAmount("0", 10n * E18)).toEqual({ ok: false, message: "Enter an amount of MUSD." });
    expect(checkAmount("11", 10n * E18)).toEqual({ ok: false, message: "That is more MUSD than this account holds." });
    expect(checkAmount("11", undefined).ok).toBe(true);
  });
});

describe("escrow helpers", () => {
  const need = 52_401_684_999_080_709_128n;
  const price = 5n * 10n ** 16n;

  it("counts the rounds an escrow pays for at the full need", () => {
    expect(roundsCovered(10n * E18, need, price)).toBe(3n);
    expect(roundsCovered(10n * E18, 0n, price)).toBeNull();
    expect(roundsCovered(10n * E18, null, price)).toBeNull();
  });

  it("suggests enough escrow for several rounds", () => {
    expect(suggestedEscrow(need, price, 4n)).toBe(10_480_336_999_816_141_828n);
    expect(suggestedEscrow(null, price, 4n)).toBeNull();
  });

  it("maps slider hundredths to a 1e18 boost", () => {
    expect(targetFromHundredths(250)).toBe(25n * 10n ** 17n);
  });
});

describe("describeFill", () => {
  it("ends every sentence with a period", () => {
    const partial = previewBid([], entry(1, 10n ** 15n, E18), 5_000n * E18, TOTALS, MIN);
    expect(describeFill(partial)).toBe("Fills in part at rank 1. Limited by votes for sale.");
    expect(describeFill(undefined)).toBe("Not priced yet.");
  });
});

describe("previewBid", () => {
  const supply = 10_000n * E18;
  const rival = entry(1, 2n * 10n ** 15n, E18);

  it("ranks a new bid behind a higher one competing for scarce votes", () => {
    const mine = entry(2, 10n ** 15n, E18);
    const preview = previewBid([rival], mine, supply, TOTALS, MIN);
    expect(preview?.rank).toBe(2);
    expect(preview?.status).toBe("unfilled");
  });

  it("puts a higher bid first, and replaces the order it updates", () => {
    const mine = { ...entry(2, 3n * 10n ** 15n, E18) };
    const preview = previewBid([rival, entry(2, 10n ** 15n, E18)], mine, supply, TOTALS, MIN);
    expect(preview?.rank).toBe(1);
    expect(preview?.status).toBe("full");
  });
});
