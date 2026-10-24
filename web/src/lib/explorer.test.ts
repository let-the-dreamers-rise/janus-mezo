import { describe, expect, it } from "vitest";
import { SITE } from "@/config/site";
import { explorerUrl, nftUrl, shortAddress } from "./explorer";

describe("explorer links", () => {
  it("shortens an address to its first six and last four characters", () => {
    expect(shortAddress("0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C")).toBe("0x8f78...Cb5C");
  });

  it("links addresses, transactions, tokens and single NFTs on the Mezo explorer", () => {
    expect(explorerUrl("address", "0xabc")).toBe(`${SITE.explorerUrl}/address/0xabc`);
    expect(explorerUrl("tx", "0x123")).toBe(`${SITE.explorerUrl}/tx/0x123`);
    expect(nftUrl("0xdef", 1714n)).toBe(`${SITE.explorerUrl}/token/0xdef/instance/1714`);
  });
});
