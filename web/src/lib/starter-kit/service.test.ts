import type { Address, Hash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KIT, type Holdings, type KitItem, type Stock } from "./kit";
import { slidingWindow } from "./limits";
import { createKitService, defaultLimits, type KitChain, type KitLimits, type SendReport } from "./service";

const FAUCET: Address = "0x1B2A0915b893B79fE1019a9Dcf141c3669C3D569";
const JUDGE: Address = "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C";
const OTHER: Address = "0x4D39F2e02E6639D893E18d36Ec8B0aAeDe09198c";
const WAD = 10n ** 18n;
const NOW = 1_800_000_000_000;

const EMPTY: Holdings = { btc: 0n, musd: 0n, veBtcCount: 0n, veMezoCount: 0n, jmezo: 0n };
const STOCKED: Stock = { btc: 10n ** 16n, musd: 200n * WAD, mezo: 100n * WAD };
const hashOf = (n: number): Hash => `0x${n.toString(16).padStart(64, "0")}`;

interface FakeOptions {
  readonly holdings?: Holdings;
  readonly stock?: Stock;
  readonly report?: (items: readonly KitItem[]) => SendReport;
  readonly failRead?: boolean;
}

function fakeChain({ holdings = EMPTY, stock = STOCKED, report, failRead = false }: FakeOptions = {}) {
  const events: string[] = [];
  const sends: { to: Address; items: readonly KitItem[] }[] = [];
  const chain: KitChain = {
    faucet: FAUCET,
    readHoldings: async (address) => {
      events.push(`holdings ${address}`);
      if (failRead) throw new Error("rpc down");
      return holdings;
    },
    readStock: async () => {
      events.push("stock");
      if (failRead) throw new Error("rpc down");
      return stock;
    },
    send: async (to, items) => {
      events.push(`send ${to}`);
      sends.push({ to, items });
      await new Promise((done) => setTimeout(done, 5));
      events.push(`sent ${to}`);
      return report ? report(items) : { sent: items.map((item, i) => ({ ...item, hash: hashOf(i + 1) })) };
    },
  };
  return { chain, events, sends };
}

const claimFor = (address: Address, ip = "203.0.113.7", now = NOW) => ({ body: { address }, ip, now });

// The service logs chain failures for the server log; keep test output clean.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("status", () => {
  it("says the kit is off when no faucet key is configured", async () => {
    const reply = await createKitService({ chain: null }).status();
    expect(reply).toEqual({ status: 200, body: { ok: true, data: { available: false, reason: "not-configured" } } });
  });

  it("reports the faucet, the kit and how many kits are left", async () => {
    const reply = await createKitService({ chain: fakeChain().chain }).status();
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({
      ok: true,
      data: {
        available: true,
        faucet: FAUCET,
        kit: { gas: KIT.gas, musd: KIT.musd, veBtc: KIT.veBtc, veMezo: KIT.veMezo },
        left: { full: 20n, veMezo: 20n },
      },
    });
  });

  it("says the faucet is empty when it cannot give anything", async () => {
    const reply = await createKitService({ chain: fakeChain({ stock: { btc: 0n, musd: 0n, mezo: 0n } }).chain }).status();
    expect(reply.body).toMatchObject({ ok: true, data: { available: false, reason: "empty" } });
  });

  it("reports a chain error when the faucet cannot be read", async () => {
    const reply = await createKitService({ chain: fakeChain({ failRead: true }).chain }).status();
    expect(reply.status).toBe(502);
    expect(reply.body).toMatchObject({ ok: false, error: { code: "chain-error" } });
  });
});

describe("claim", () => {
  it("refuses when the kit is not configured", async () => {
    const reply = await createKitService({ chain: null }).claim(claimFor(JUDGE));
    expect(reply.status).toBe(503);
    expect(reply.body).toMatchObject({ ok: false, error: { code: "unavailable" } });
  });

  it("rejects a request without a valid address", async () => {
    const reply = await createKitService({ chain: fakeChain().chain }).claim({ body: { address: "0x12" }, ip: "a", now: NOW });
    expect(reply.status).toBe(400);
    expect(reply.body).toMatchObject({ ok: false, error: { code: "invalid-request" } });
  });

  it("sends a fresh wallet the whole kit, in order", async () => {
    const fake = fakeChain();
    const reply = await createKitService({ chain: fake.chain }).claim(claimFor(JUDGE));
    expect(reply.status).toBe(200);
    expect(fake.sends).toHaveLength(1);
    expect(fake.sends[0]?.to).toBe(JUDGE);
    expect(fake.sends[0]?.items.map((item) => item.kind)).toEqual(["gas", "musd", "veBtc", "veMezo"]);
    expect(reply.body).toMatchObject({ ok: true, data: { address: JUDGE, skipped: [] } });
  });

  it("sends nothing to a wallet that has the whole kit", async () => {
    const holdings = { btc: KIT.gas, musd: KIT.musd, veBtcCount: 1n, veMezoCount: 1n, jmezo: 0n };
    const fake = fakeChain({ holdings });
    const reply = await createKitService({ chain: fake.chain }).claim(claimFor(JUDGE));
    expect(reply.status).toBe(200);
    expect(fake.sends).toEqual([]);
    expect(reply.body).toMatchObject({ ok: true, data: { sent: [] } });
  });

  it("says the faucet is out when nothing the wallet needs is in stock", async () => {
    const fake = fakeChain({ stock: { btc: 0n, musd: 0n, mezo: 0n } });
    const reply = await createKitService({ chain: fake.chain }).claim(claimFor(JUDGE));
    expect(reply.status).toBe(503);
    expect(reply.body).toMatchObject({ ok: false, error: { code: "out-of-stock" } });
    expect(fake.sends).toEqual([]);
  });

  it("gives one address at most two kits a day", async () => {
    const service = createKitService({ chain: fakeChain().chain });
    expect((await service.claim(claimFor(JUDGE, "1.1.1.1"))).status).toBe(200);
    expect((await service.claim(claimFor(JUDGE, "2.2.2.2"))).status).toBe(200);
    const third = await service.claim(claimFor(JUDGE, "3.3.3.3"));
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ ok: false, error: { code: "rate-limited", retryAfterSeconds: 86_400 } });
  });

  it("limits kits per IP address across wallets", async () => {
    const limits: KitLimits = { ...defaultLimits(), kitsPerIp: slidingWindow({ max: 1, ms: 3_600_000 }) };
    const service = createKitService({ chain: fakeChain().chain, limits });
    expect((await service.claim(claimFor(JUDGE))).status).toBe(200);
    const second = await service.claim(claimFor(OTHER));
    expect(second.status).toBe(429);
  });

  it("limits how often one IP address may ask at all", async () => {
    const limits: KitLimits = { ...defaultLimits(), requestsPerIp: slidingWindow({ max: 2, ms: 600_000 }) };
    const service = createKitService({ chain: fakeChain().chain, limits });
    await service.claim({ body: null, ip: "9.9.9.9", now: NOW });
    await service.claim({ body: null, ip: "9.9.9.9", now: NOW });
    const third = await service.claim(claimFor(JUDGE, "9.9.9.9"));
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ ok: false, error: { retryAfterSeconds: 600 } });
  });

  it("does not count a request that sent nothing against the kit limits", async () => {
    const limits: KitLimits = { ...defaultLimits(), kitsPerAddress: slidingWindow({ max: 1, ms: 3_600_000 }) };
    const holdings = { btc: KIT.gas, musd: KIT.musd, veBtcCount: 1n, veMezoCount: 1n, jmezo: 0n };
    const stocked = createKitService({ chain: fakeChain({ holdings }).chain, limits });
    await stocked.claim(claimFor(JUDGE));
    expect(limits.kitsPerAddress.wait(JUDGE.toLowerCase(), NOW)).toBe(0);
  });

  it("returns what was sent when a later item fails", async () => {
    const report = (items: readonly KitItem[]): SendReport => ({
      sent: items.slice(0, 2).map((item, i) => ({ ...item, hash: hashOf(i + 1) })),
      failed: { kind: "veBtc", message: "veBTC lock reverted" },
    });
    const reply = await createKitService({ chain: fakeChain({ report }).chain }).claim(claimFor(JUDGE));
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({
      ok: true,
      data: { failed: { kind: "veBtc", message: "veBTC lock reverted" } },
    });
  });

  it("reports a chain error when nothing could be sent", async () => {
    const report = (): SendReport => ({ sent: [], failed: { kind: "gas", message: "nonce too low" } });
    const reply = await createKitService({ chain: fakeChain({ report }).chain }).claim(claimFor(JUDGE));
    expect(reply.status).toBe(502);
    expect(reply.body).toMatchObject({ ok: false, error: { code: "chain-error", message: "nonce too low" } });
  });

  it("reports a chain error when sending throws outright", async () => {
    const report = (): SendReport => {
      throw new Error("rpc down");
    };
    const reply = await createKitService({ chain: fakeChain({ report }).chain }).claim(claimFor(JUDGE));
    expect(reply.status).toBe(502);
    expect(reply.body).toMatchObject({ ok: false, error: { code: "chain-error" } });
  });

  it("reports a chain error when the wallet cannot be read", async () => {
    const reply = await createKitService({ chain: fakeChain({ failRead: true }).chain }).claim(claimFor(JUDGE));
    expect(reply.status).toBe(502);
  });

  it("handles one kit at a time so faucet nonces never collide", async () => {
    const fake = fakeChain();
    const service = createKitService({ chain: fake.chain });
    await Promise.all([service.claim(claimFor(JUDGE, "1.1.1.1")), service.claim(claimFor(OTHER, "2.2.2.2"))]);
    const firstDone = fake.events.indexOf(`sent ${JUDGE}`);
    const secondRead = fake.events.indexOf(`holdings ${OTHER}`);
    expect(firstDone).toBeGreaterThan(-1);
    expect(secondRead).toBeGreaterThan(firstDone);
  });
});
