import { describe, expect, it } from "vitest";
import { SECTIONS, factHref } from "./facts";

const links = SECTIONS.flatMap((section) => section.facts.flatMap((fact) => fact.links));

describe("transparency facts", () => {
  it("backs every fact with at least one link", () => {
    for (const fact of SECTIONS.flatMap((section) => section.facts)) {
      expect(fact.links.length, fact.title).toBeGreaterThan(0);
    }
  });

  it("proves the mainnet launch with mainnet transactions", () => {
    const mainnet = SECTIONS.find((section) => section.id === "mainnet");
    expect(mainnet?.facts.flatMap((fact) => fact.links).some((link) => link.kind === "mainnet-tx")).toBe(true);
  });

  it("uses well-formed hashes and addresses", () => {
    for (const link of links) {
      if (link.kind.endsWith("-tx")) expect(link.value, link.label).toMatch(/^0x[0-9a-f]{64}$/);
      if (link.kind.endsWith("-address")) expect(link.value, link.label).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it("has unique section ids", () => {
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length);
  });

  it("links each kind to the right explorer or the repo", () => {
    expect(factHref({ label: "a", kind: "mainnet-tx", value: "0x1" })).toBe("https://explorer.mezo.org/tx/0x1");
    expect(factHref({ label: "b", kind: "mainnet-address", value: "0x2" })).toBe("https://explorer.mezo.org/address/0x2");
    expect(factHref({ label: "c", kind: "matsnet-tx", value: "0x3" })).toBe("https://explorer.test.mezo.org/tx/0x3");
    expect(factHref({ label: "d", kind: "matsnet-address", value: "0x4" })).toBe("https://explorer.test.mezo.org/address/0x4");
    expect(factHref({ label: "e", kind: "code", value: "SECURITY_REVIEW.md" })).toBe(
      "https://github.com/let-the-dreamers-rise/janus-mezo/blob/main/SECURITY_REVIEW.md",
    );
  });
});
