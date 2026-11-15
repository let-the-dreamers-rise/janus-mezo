import { getAddress, zeroAddress } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

/// A mainnet build must read mainnet addresses everywhere, and stay switched off until the
/// real deployment record exists. Modules read the env at import, so each test re-imports.
async function load(network: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_JANUS_NETWORK", network ?? "");
  const deployment = await import("./deployment");
  const contracts = await import("@/lib/chain/contracts");
  const site = await import("./site");
  return { ...deployment, ...contracts, SITE: site.SITE };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("a mainnet build", () => {
  it("reads the mainnet deployment and protocol addresses", async () => {
    const build = await load("mainnet");
    expect(build.DEPLOYMENT.chainId).toBe(31612);
    expect(build.DEPLOYMENT.boostVoter).toBe(getAddress("0x2Ba614a598Cffa5a19d683cDCA97bac3a49313d1"));
    expect(build.DEPLOYMENT.veBtc).toBe(getAddress("0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279"));
    expect(build.DEX_ROUTER).toBe("0x16A76d3cd3C1e3CE843C6680d6B37E9116b5C706");
    expect(build.DEX_FACTORY).toBe("0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248");
    expect(getAddress(build.BOOST_GAUGE_FACTORY)).toBe(getAddress("0x4150dce1c6d013fa7ebaf4ffcd879d08daa0ccad"));
  });

  it("stays switched off until the contracts are deployed", async () => {
    const build = await load("mainnet");
    if (build.DEPLOYMENT.vault === zeroAddress) expect(build.IS_DEPLOYED).toBe(false);
    else expect(build.IS_DEPLOYED).toBe(true);
  });

  it("links the site to the mainnet explorer", async () => {
    const build = await load("mainnet");
    expect(build.SITE.explorerUrl).toBe("https://explorer.mezo.org");
  });
});

describe("a default build", () => {
  it("stays on matsnet", async () => {
    const build = await load(undefined);
    expect(build.DEPLOYMENT.chainId).toBe(31611);
    expect(build.DEX_ROUTER).toBe("0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9");
    expect(build.SITE.explorerUrl).toBe("https://explorer.test.mezo.org");
  });
});
