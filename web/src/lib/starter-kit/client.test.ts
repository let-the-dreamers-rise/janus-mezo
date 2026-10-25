import { describe, expect, it } from "vitest";
import { KitRequestError, claimKit, fetchKitStatus, KIT_ENDPOINT } from "./client";

const JUDGE = "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C";
const HASH = `0x${"ab".repeat(32)}`;

function fakeFetch(status: number, body: unknown) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const impl = async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  return { impl: impl as typeof fetch, requests };
}

describe("fetchKitStatus", () => {
  it("reads amounts back as bigints", async () => {
    const { impl, requests } = fakeFetch(200, {
      ok: true,
      data: {
        available: true,
        faucet: "0x1B2A0915b893B79fE1019a9Dcf141c3669C3D569",
        kit: { gas: "10000000000000", musd: "5000000000000000000", veBtc: "1000000000000", veMezo: "5000000000000000000" },
        left: { full: "20", gas: "600", musd: "47", veBtc: "6000", veMezo: "20" },
      },
    });
    const status = await fetchKitStatus(impl);
    expect(requests[0]?.url).toBe(KIT_ENDPOINT);
    expect(status).toEqual({
      available: true,
      faucet: "0x1B2A0915b893B79fE1019a9Dcf141c3669C3D569",
      kit: { gas: 10n ** 13n, musd: 5n * 10n ** 18n, veBtc: 10n ** 12n, veMezo: 5n * 10n ** 18n },
      left: { full: 20n, gas: 600n, musd: 47n, veBtc: 6000n, veMezo: 20n },
    });
  });

  it("passes on why the kit is off", async () => {
    const { impl } = fakeFetch(200, { ok: true, data: { available: false, reason: "not-configured" } });
    expect(await fetchKitStatus(impl)).toEqual({ available: false, reason: "not-configured" });
  });

  it("throws the server's message on an error reply", async () => {
    const { impl } = fakeFetch(502, { ok: false, error: { code: "chain-error", message: "Mezo did not answer." } });
    await expect(fetchKitStatus(impl)).rejects.toThrow("Mezo did not answer.");
  });

  it("throws a plain message for a reply that is not JSON", async () => {
    const { impl } = fakeFetch(500, "<html>oops</html>");
    await expect(fetchKitStatus(impl)).rejects.toThrow("The server sent an unexpected reply. Try again.");
  });
});

describe("claimKit", () => {
  it("posts the address and reads back what was sent", async () => {
    const { impl, requests } = fakeFetch(200, {
      ok: true,
      data: {
        address: JUDGE,
        sent: [
          { kind: "gas", amount: "10000000000000", hash: HASH },
          { kind: "veBtc", amount: "1000000000000", hash: HASH, tokenId: "1716" },
        ],
        skipped: [{ kind: "musd", reason: "has-enough" }],
      },
    });
    const claim = await claimKit(JUDGE, impl);
    expect(requests[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({ address: JUDGE });
    expect(claim.sent).toEqual([
      { kind: "gas", amount: 10n ** 13n, hash: HASH },
      { kind: "veBtc", amount: 10n ** 12n, hash: HASH, tokenId: 1716n },
    ]);
    expect(claim.skipped).toEqual([{ kind: "musd", reason: "has-enough" }]);
    expect(claim.failed).toBeUndefined();
  });

  it("keeps the failed item of a partial kit", async () => {
    const { impl } = fakeFetch(200, {
      ok: true,
      data: { address: JUDGE, sent: [], skipped: [], failed: { kind: "veMezo", message: "reverted" } },
    });
    expect((await claimKit(JUDGE, impl)).failed).toEqual({ kind: "veMezo", message: "reverted" });
  });

  it("throws a KitRequestError carrying the code and the wait", async () => {
    const { impl } = fakeFetch(429, {
      ok: false,
      error: { code: "rate-limited", message: "Slow down.", retryAfterSeconds: 120 },
    });
    const error = await claimKit(JUDGE, impl).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(KitRequestError);
    expect(error).toMatchObject({ code: "rate-limited", message: "Slow down.", retryAfterSeconds: 120 });
  });

  it("rejects a reply with an unknown item kind", async () => {
    const { impl } = fakeFetch(200, {
      ok: true,
      data: { address: JUDGE, sent: [{ kind: "nft", amount: "1", hash: HASH }], skipped: [] },
    });
    await expect(claimKit(JUDGE, impl)).rejects.toThrow(KitRequestError);
  });

  it("reports a network failure in plain words", async () => {
    const impl = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await expect(claimKit(JUDGE, impl)).rejects.toThrow("Could not reach Janus. Check your connection and try again.");
  });
});
