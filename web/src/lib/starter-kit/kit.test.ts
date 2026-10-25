import { describe, expect, it } from "vitest";
import { KIT, kitsLeft, planKit, wanted, type Holdings, type Stock } from "./kit";

const SAT = 10n ** 10n;
const WAD = 10n ** 18n;

const EMPTY: Holdings = { btc: 0n, musd: 0n, veBtcCount: 0n, veMezoCount: 0n, jmezo: 0n };
const FULL_STOCK: Stock = { btc: 10n ** 16n, musd: 200n * WAD, mezo: 100n * WAD };

describe("wanted", () => {
  it("asks for the whole kit for a fresh wallet", () => {
    expect(wanted(EMPTY)).toEqual([
      { kind: "gas", amount: KIT.gas },
      { kind: "musd", amount: KIT.musd },
      { kind: "veBtc", amount: KIT.veBtc },
      { kind: "veMezo", amount: KIT.veMezo },
    ]);
  });

  it("tops gas and MUSD up to the kit amount instead of adding a full kit", () => {
    const items = wanted({ ...EMPTY, btc: 150n * SAT, musd: WAD / 2n });
    expect(items).toContainEqual({ kind: "gas", amount: KIT.gas - 150n * SAT });
    expect(items).toContainEqual({ kind: "musd", amount: KIT.musd - WAD / 2n });
  });

  it("leaves out gas and MUSD the wallet already has enough of", () => {
    const kinds = wanted({ ...EMPTY, btc: KIT.gasFloor, musd: KIT.musdFloor }).map((item) => item.kind);
    expect(kinds).toEqual(["veBtc", "veMezo"]);
  });

  it("counts a deposited veMEZO lock, held as jMEZO, as having one", () => {
    const kinds = wanted({ ...EMPTY, jmezo: 5n * WAD }).map((item) => item.kind);
    expect(kinds).not.toContain("veMezo");
  });

  it("skips the locks for a wallet that already holds both NFTs", () => {
    const kinds = wanted({ ...EMPTY, veBtcCount: 1n, veMezoCount: 2n }).map((item) => item.kind);
    expect(kinds).toEqual(["gas", "musd"]);
  });
});

describe("planKit", () => {
  it("sends everything a fresh wallet is missing when the faucet is stocked", () => {
    const plan = planKit(EMPTY, FULL_STOCK);
    expect(plan.send.map((item) => item.kind)).toEqual(["gas", "musd", "veBtc", "veMezo"]);
    expect(plan.skipped).toEqual([]);
  });

  it("reports what the wallet already has", () => {
    const plan = planKit({ btc: KIT.gas, musd: KIT.musd, veBtcCount: 1n, veMezoCount: 1n, jmezo: 0n }, FULL_STOCK);
    expect(plan.send).toEqual([]);
    expect(plan.skipped).toEqual([
      { kind: "gas", reason: "has-enough" },
      { kind: "musd", reason: "has-enough" },
      { kind: "veBtc", reason: "has-enough" },
      { kind: "veMezo", reason: "has-enough" },
    ]);
  });

  it("still sends the rest when the faucet has no MEZO", () => {
    const plan = planKit(EMPTY, { ...FULL_STOCK, mezo: 0n });
    expect(plan.send.map((item) => item.kind)).toEqual(["gas", "musd", "veBtc"]);
    expect(plan.skipped).toEqual([{ kind: "veMezo", reason: "out-of-stock" }]);
  });

  it("keeps the faucet's gas reserve out of what it gives away", () => {
    const plan = planKit(EMPTY, { ...FULL_STOCK, btc: KIT.reserve + KIT.gas });
    expect(plan.send.map((item) => item.kind)).toEqual(["gas", "musd", "veMezo"]);
    expect(plan.skipped).toEqual([{ kind: "veBtc", reason: "out-of-stock" }]);
  });

  it("draws gas and the veBTC lock from the same BTC balance", () => {
    const plan = planKit(EMPTY, { ...FULL_STOCK, btc: KIT.reserve + KIT.veBtc });
    expect(plan.skipped).toContainEqual({ kind: "gas", reason: "out-of-stock" });
    expect(plan.send.map((item) => item.kind)).toContain("veBtc");
  });

  it("sends nothing from an empty faucet", () => {
    const plan = planKit(EMPTY, { btc: 0n, musd: 0n, mezo: 0n });
    expect(plan.send).toEqual([]);
    expect(plan.skipped.every((skip) => skip.reason === "out-of-stock")).toBe(true);
  });
});

describe("kitsLeft", () => {
  it("counts whole kits by the scarcest stock", () => {
    const left = kitsLeft(FULL_STOCK);
    expect(left.musd).toBe(40n);
    expect(left.veMezo).toBe(20n);
    expect(left.full).toBe(20n);
  });

  it("splits free BTC between gas and the veBTC lock", () => {
    const btc = KIT.reserve + 3n * (KIT.gas + KIT.veBtc);
    const left = kitsLeft({ ...FULL_STOCK, btc });
    expect(left.full).toBe(3n);
    expect(left.veBtc).toBe((btc - KIT.reserve) / KIT.veBtc);
  });

  it("is zero below the reserve, never negative", () => {
    const left = kitsLeft({ btc: KIT.reserve / 2n, musd: 0n, mezo: 0n });
    expect(left).toEqual({ full: 0n, gas: 0n, musd: 0n, veBtc: 0n, veMezo: 0n });
  });
});
