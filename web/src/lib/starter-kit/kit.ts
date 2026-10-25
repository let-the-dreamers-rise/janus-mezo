/// The starter kit: what a judge or tester gets in one click so both sides of Janus can be
/// tried without hunting faucets. The faucet wallet sends it from /api/starter-kit. Sizes
/// are picked against matsnet's supplies today (88.7M veMEZO power, 16.9 veBTC power).
const SATOSHI = 10n ** 10n;
const WAD = 10n ** 18n;
const DAY = 86_400n;

export const KIT = {
  /// Gas BTC is topped up to this once a wallet holds less than `gasFloor`. A transaction
  /// costs well under a satoshi on matsnet, so this covers every step many times over.
  gas: 1_000n * SATOSHI,
  gasFloor: 200n * SATOSHI,
  /// MUSD for bids, topped up to `musd` below `musdFloor`.
  musd: 5n * WAD,
  musdFloor: 1n * WAD,
  /// A 100-sat veBTC lock: about five veMEZO votes lift it to the 5x cap.
  veBtc: 100n * SATOSHI,
  /// veBTC's longest lock; the escrow rounds the end down to a week.
  veBtcLock: 28n * DAY,
  /// A 5 MEZO veMEZO lock: one shard that can vote in this epoch's round.
  veMezo: 5n * WAD,
  /// veMEZO's longest lock, 208 weeks. The vault makes a deposited lock permanent anyway.
  veMezoLock: 1_456n * DAY,
  /// BTC the faucet keeps back for its own gas.
  reserve: 5_000n * SATOSHI,
} as const;

export type KitConfig = { readonly [K in keyof typeof KIT]: bigint };

export const KIT_KINDS = ["gas", "musd", "veBtc", "veMezo"] as const;
export type KitKind = (typeof KIT_KINDS)[number];

/// What a wallet holds, as far as the kit cares.
export interface Holdings {
  readonly btc: bigint;
  readonly musd: bigint;
  readonly veBtcCount: bigint;
  readonly veMezoCount: bigint;
  /// jMEZO: a veMEZO lock already deposited into the vault.
  readonly jmezo: bigint;
}

/// What the faucet wallet holds.
export interface Stock {
  readonly btc: bigint;
  readonly musd: bigint;
  readonly mezo: bigint;
}

export interface KitItem {
  readonly kind: KitKind;
  readonly amount: bigint;
}

export type SkipReason = "has-enough" | "out-of-stock";

export interface Skipped {
  readonly kind: KitKind;
  readonly reason: SkipReason;
}

export interface KitPlan {
  readonly send: readonly KitItem[];
  readonly skipped: readonly Skipped[];
}

export interface KitsLeft {
  /// Whole kits: every item for a fresh wallet.
  readonly full: bigint;
  readonly gas: bigint;
  readonly musd: bigint;
  readonly veBtc: bigint;
  readonly veMezo: bigint;
}

/// The kit items a wallet holding `holdings` is missing, in the order they are sent.
export function wanted(holdings: Holdings, kit: KitConfig = KIT): readonly KitItem[] {
  const candidates: readonly (KitItem | null)[] = [
    holdings.btc < kit.gasFloor ? { kind: "gas", amount: kit.gas - holdings.btc } : null,
    holdings.musd < kit.musdFloor ? { kind: "musd", amount: kit.musd - holdings.musd } : null,
    holdings.veBtcCount === 0n ? { kind: "veBtc", amount: kit.veBtc } : null,
    holdings.veMezoCount === 0n && holdings.jmezo === 0n ? { kind: "veMezo", amount: kit.veMezo } : null,
  ];
  return candidates.filter((item): item is KitItem => item !== null);
}

type Pool = keyof Stock;
const poolOf = (kind: KitKind): Pool => (kind === "musd" ? "musd" : kind === "veMezo" ? "mezo" : "btc");

const freeBtc = (stock: Stock, kit: KitConfig): bigint => (stock.btc > kit.reserve ? stock.btc - kit.reserve : 0n);

/// Which missing items the faucet can send now. Gas and the veBTC lock share its BTC.
export function planKit(holdings: Holdings, stock: Stock, kit: KitConfig = KIT): KitPlan {
  const want = wanted(holdings, kit);
  const enough: readonly Skipped[] = KIT_KINDS.filter((kind) => !want.some((item) => item.kind === kind)).map(
    (kind) => ({ kind, reason: "has-enough" }),
  );
  const start = {
    left: { ...stock, btc: freeBtc(stock, kit) } as Stock,
    send: [] as readonly KitItem[],
    out: [] as readonly Skipped[],
  };
  const result = want.reduce((acc, item) => {
    const pool = poolOf(item.kind);
    if (acc.left[pool] < item.amount) {
      return { ...acc, out: [...acc.out, { kind: item.kind, reason: "out-of-stock" as const }] };
    }
    return { left: { ...acc.left, [pool]: acc.left[pool] - item.amount }, send: [...acc.send, item], out: acc.out };
  }, start);
  return { send: result.send, skipped: [...enough, ...result.out] };
}

const min = (...values: readonly bigint[]): bigint => values.reduce((a, b) => (b < a ? b : a));

/// How many of each item, and of whole kits, the faucet can still give.
export function kitsLeft(stock: Stock, kit: KitConfig = KIT): KitsLeft {
  const btc = freeBtc(stock, kit);
  const musd = stock.musd / kit.musd;
  const veMezo = stock.mezo / kit.veMezo;
  return {
    full: min(btc / (kit.gas + kit.veBtc), musd, veMezo),
    gas: btc / kit.gas,
    musd,
    veBtc: btc / kit.veBtc,
    veMezo,
  };
}
