import type { Hash } from "viem";
import { describe, expect, it } from "vitest";
import type { AccountSnapshot } from "@/lib/chain/account-snapshot";
import { describeClaim, holdingsOf, listOf } from "./view";

const HASH: Hash = `0x${"ab".repeat(32)}`;
const JUDGE = "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C";

describe("listOf", () => {
  it("joins names the way a sentence does", () => {
    expect(listOf([])).toBe("");
    expect(listOf(["a"])).toBe("a");
    expect(listOf(["a", "b"])).toBe("a and b");
    expect(listOf(["a", "b", "c"])).toBe("a, b and c");
  });
});

describe("describeClaim", () => {
  it("names every item that arrived, with NFT ids", () => {
    const result = describeClaim({
      address: JUDGE,
      sent: [
        { kind: "gas", amount: 1n, hash: HASH },
        { kind: "musd", amount: 1n, hash: HASH },
        { kind: "veBtc", amount: 1n, hash: HASH, tokenId: 1716n },
        { kind: "veMezo", amount: 1n, hash: HASH, tokenId: 2001n },
      ],
      skipped: [],
    });
    expect(result).toEqual({
      title: "Starter kit sent",
      detail: "Gas BTC, MUSD, veBTC NFT #1716 and veMEZO NFT #2001 are in your wallet.",
    });
  });

  it("says when there was nothing to send", () => {
    expect(describeClaim({ address: JUDGE, sent: [], skipped: [{ kind: "gas", reason: "has-enough" }] }).title).toBe(
      "You already have the whole kit",
    );
  });

  it("explains a partial kit and how to get the rest", () => {
    const result = describeClaim({
      address: JUDGE,
      sent: [{ kind: "gas", amount: 1n, hash: HASH }],
      skipped: [],
      failed: { kind: "veMezo", message: "The transaction reverted." },
    });
    expect(result).toEqual({
      title: "Part of the starter kit arrived",
      detail: "Gas BTC arrived. The veMEZO NFT did not go through: The transaction reverted. Ask again for the rest.",
    });
  });

  it("reports a kit where nothing arrived", () => {
    const result = describeClaim({ address: JUDGE, sent: [], skipped: [], failed: { kind: "gas", message: "nonce too low" } });
    expect(result.title).toBe("The starter kit did not arrive");
  });
});

describe("holdingsOf", () => {
  it("counts NFTs and keeps balances", () => {
    const account = {
      address: JUDGE,
      btc: 5n,
      mezo: 0n,
      musd: 7n,
      musdAllowance: 0n,
      jmezo: 9n,
      claimable: 0n,
      claimed: 0n,
      veBtc: [{}, {}],
      veMezo: [{}],
    } as unknown as AccountSnapshot;
    expect(holdingsOf(account)).toEqual({ btc: 5n, musd: 7n, veBtcCount: 2n, veMezoCount: 1n, jmezo: 9n });
  });
});
