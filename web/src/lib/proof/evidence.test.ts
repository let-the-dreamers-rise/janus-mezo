import { describe, expect, it } from "vitest";
import { PROOF_ITEMS, proofHref, statusCounts } from "./evidence";

const links = PROOF_ITEMS.flatMap((item) => item.links);

describe("proof evidence", () => {
  it("answers every point of the Wave 1 feedback once", () => {
    const ids = PROOF_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining(["outside-bids", "rounds", "bribes", "pokes", "fungibility", "verified", "vebtc-address", "mainnet", "pool", "materials"]),
    );
  });

  it("never marks something proven without a link to the chain", () => {
    for (const item of PROOF_ITEMS.filter((entry) => entry.status === "proven")) {
      expect(item.links.some((link) => link.kind !== "code"), item.id).toBe(true);
    }
  });

  it("states a limit on everything not fully proven", () => {
    for (const item of PROOF_ITEMS.filter((entry) => entry.status !== "proven")) {
      expect(item.limit, item.id).toBeTruthy();
    }
  });

  it("does not present the demo-wallet bids as outside demand", () => {
    const item = PROOF_ITEMS.find((entry) => entry.id === "outside-bids");
    expect(item?.status).toBe("partial");
    expect(item?.limit).toMatch(/our own/i);
  });

  it("uses well-formed hashes and addresses", () => {
    for (const link of links) {
      if (link.kind === "tx") expect(link.value).toMatch(/^0x[0-9a-f]{64}$/);
      if (link.kind === "address" || link.kind === "mainnet") expect(link.value).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it("builds explorer and source links", () => {
    expect(proofHref({ label: "a", kind: "tx", value: "0xabc" })).toBe("https://explorer.test.mezo.org/tx/0xabc");
    expect(proofHref({ label: "m", kind: "mainnet", value: "0xabc" })).toBe("https://explorer.mezo.org/address/0xabc");
    expect(proofHref({ label: "b", kind: "code", value: "contracts/src/JanusVault.sol" })).toBe(
      "https://github.com/let-the-dreamers-rise/janus-mezo/blob/main/contracts/src/JanusVault.sol",
    );
  });

  it("counts items by status", () => {
    const counts = statusCounts(PROOF_ITEMS);
    expect(counts.proven + counts.built + counts.partial + counts.open).toBe(PROOF_ITEMS.length);
  });
});
