import { describe, expect, it } from "vitest";
import { networkInfo, parseNetwork } from "./network";

describe("parseNetwork", () => {
  it("defaults to matsnet", () => {
    expect(parseNetwork(undefined)).toBe("matsnet");
    expect(parseNetwork("")).toBe("matsnet");
  });

  it("accepts mainnet only when named exactly", () => {
    expect(parseNetwork("mainnet")).toBe("mainnet");
  });

  it("fails the build on a typo instead of silently picking a network", () => {
    expect(() => parseNetwork("mainet")).toThrow(/NEXT_PUBLIC_JANUS_NETWORK/);
  });
});

describe("networkInfo", () => {
  it("points each network at its own chain and explorer", () => {
    expect(networkInfo("matsnet")).toMatchObject({ chainId: 31611, explorerUrl: "https://explorer.test.mezo.org", demoEnabled: true });
    expect(networkInfo("mainnet")).toMatchObject({ chainId: 31612, explorerUrl: "https://explorer.mezo.org" });
  });

  it("never offers the demo wallet or free starter kit on mainnet", () => {
    expect(networkInfo("mainnet").demoEnabled).toBe(false);
  });

  it("links each site to its twin on the other network", () => {
    expect(networkInfo("mainnet").twin).toEqual({ url: "https://janus-mezo-testnet.vercel.app", label: "Try the free testnet demo" });
    expect(networkInfo("matsnet").twin).toEqual({ url: "https://janus-mezo.vercel.app", label: "Live on mainnet" });
  });

  it("labels what users are on", () => {
    expect(networkInfo("matsnet").label).toBe("Mezo Matsnet");
    expect(networkInfo("mainnet").label).toBe("Mezo Mainnet");
  });
});
