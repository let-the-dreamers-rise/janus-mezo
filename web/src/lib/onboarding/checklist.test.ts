import { describe, expect, it } from "vitest";
import type { AccountSnapshot, VeBtcNft } from "@/lib/chain/account-snapshot";
import { checklist, nextStep } from "./checklist";

const ONE = 10n ** 18n;
const GAUGE = "0x4D39F2e02E6639D893E18d36Ec8B0aAeDe09198c";

const nft = (overrides: Partial<VeBtcNft> = {}): VeBtcNft => ({
  id: 1716n,
  amount: 10n ** 12n,
  end: 0n,
  permanent: false,
  boostable: 10n ** 12n,
  appliedBoost: 0n,
  liveBoost: ONE,
  gauge: undefined,
  gaugeAlive: false,
  gaugeWeight: 0n,
  orderId: 0n,
  ...overrides,
});

const account = (overrides: Partial<AccountSnapshot> = {}): AccountSnapshot => ({
  address: "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C",
  btc: 0n,
  mezo: 0n,
  musd: 0n,
  musdAllowance: 0n,
  jmezo: 0n,
  claimable: 0n,
  claimed: 0n,
  veBtc: [],
  veMezo: [],
  ...overrides,
});

const doneIds = (steps: ReturnType<typeof checklist>) => steps.filter((step) => step.done).map((step) => step.id);

describe("checklist", () => {
  it("lists eight steps across both faces, none done before a wallet connects", () => {
    const steps = checklist({ connected: false, account: undefined });
    expect(steps.map((step) => step.id)).toEqual(["wallet", "kit", "gauge", "bid", "deposit", "round", "boost", "claim"]);
    expect(doneIds(steps)).toEqual([]);
    expect(nextStep(steps)?.id).toBe("wallet");
  });

  it("ticks the wallet once one is connected, then points at the kit", () => {
    const steps = checklist({ connected: true, account: account() });
    expect(doneIds(steps)).toEqual(["wallet"]);
    expect(nextStep(steps)?.id).toBe("kit");
  });

  it("ignores chain data for a read-only preview", () => {
    const steps = checklist({ connected: false, account: account({ jmezo: ONE, claimed: ONE }) });
    expect(doneIds(steps)).toEqual([]);
  });

  it("counts the kit as taken once the wallet holds an NFT or jMEZO", () => {
    expect(doneIds(checklist({ connected: true, account: account({ veBtc: [nft()] }) }))).toContain("kit");
    expect(doneIds(checklist({ connected: true, account: account({ jmezo: ONE }) }))).toContain("kit");
  });

  it("follows a veBTC NFT from gauge to bid to applied boost", () => {
    const withGauge = checklist({ connected: true, account: account({ veBtc: [nft({ gauge: GAUGE, gaugeAlive: true })] }) });
    expect(doneIds(withGauge)).toEqual(["wallet", "kit", "gauge"]);
    expect(nextStep(withGauge)?.id).toBe("bid");

    const bidding = checklist({ connected: true, account: account({ veBtc: [nft({ gauge: GAUGE, orderId: 3n })] }) });
    expect(doneIds(bidding)).toContain("bid");
    expect(doneIds(bidding)).not.toContain("round");

    const filled = checklist({
      connected: true,
      account: account({ veBtc: [nft({ gauge: GAUGE, orderId: 3n, gaugeWeight: 5n * ONE, appliedBoost: 5n * ONE })] }),
    });
    expect(doneIds(filled)).toEqual(expect.arrayContaining(["bid", "round", "boost"]));
  });

  it("keeps a bid ticked after its escrow ran out, since its votes landed", () => {
    const spent = checklist({ connected: true, account: account({ veBtc: [nft({ gauge: GAUGE, gaugeWeight: ONE })] }) });
    expect(doneIds(spent)).toContain("bid");
  });

  it("follows a veMEZO lock from deposit to round to claim", () => {
    expect(doneIds(checklist({ connected: true, account: account({ jmezo: 5n * ONE }) }))).toEqual(["wallet", "kit", "deposit"]);
    expect(doneIds(checklist({ connected: true, account: account({ jmezo: 5n * ONE, claimable: 1n }) }))).toContain("round");
    const claimed = checklist({ connected: true, account: account({ jmezo: 5n * ONE, claimed: 1n }) });
    expect(doneIds(claimed)).toEqual(expect.arrayContaining(["deposit", "round", "claim"]));
  });

  it("has no next step once everything is done", () => {
    const steps = checklist({
      connected: true,
      account: account({
        jmezo: ONE,
        claimed: ONE,
        veBtc: [nft({ gauge: GAUGE, orderId: 1n, gaugeWeight: ONE, appliedBoost: 2n * ONE })],
      }),
    });
    expect(steps.every((step) => step.done)).toBe(true);
    expect(nextStep(steps)).toBeUndefined();
  });

  it("gives every step somewhere to go", () => {
    for (const step of checklist({ connected: false, account: undefined })) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.detail.length).toBeGreaterThan(0);
    }
    const links = checklist({ connected: false, account: undefined }).map((step) => step.href);
    expect(links).toEqual([undefined, "#starter-kit", "/boost/", "/boost/", "/earn/", "/market/", "/boost/", "/earn/"]);
  });
});
