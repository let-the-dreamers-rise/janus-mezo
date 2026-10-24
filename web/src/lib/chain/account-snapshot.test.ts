import { zeroAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { fakeClient, onRead } from "@/test/fake-client";
import { depositBlocker, readAccountSnapshot } from "./account-snapshot";
import { marketContract, mezoTokenContract, musdContract, vaultContract, veBtcContract, veMezoContract, voterContract } from "./contracts";

const NOW = 1_800_000_000n;
const MIN = 10n ** 18n;
const lock = { escrowType: 0, vestingEnd: 0n, amount: 5n * MIN, end: NOW + 86_400n, permanent: false };

describe("depositBlocker", () => {
  it("accepts a normal, vested, live lock at or above the minimum", () => {
    expect(depositBlocker(lock, NOW, MIN)).toBeUndefined();
    expect(depositBlocker({ ...lock, end: 0n, permanent: true }, NOW, MIN)).toBeUndefined();
    expect(depositBlocker({ ...lock, amount: MIN }, NOW, MIN)).toBeUndefined();
  });

  it("names each reason JanusVault would reject a lock", () => {
    expect(depositBlocker({ ...lock, escrowType: 2 }, NOW, MIN)).toMatch(/normal veMEZO/);
    expect(depositBlocker({ ...lock, vestingEnd: NOW + 1n }, NOW, MIN)).toMatch(/vesting/);
    expect(depositBlocker({ ...lock, amount: 0n }, NOW, MIN)).toMatch(/empty/);
    expect(depositBlocker({ ...lock, amount: MIN - 1n }, NOW, MIN)).toMatch(/minimum/);
    expect(depositBlocker({ ...lock, end: NOW }, NOW, MIN)).toMatch(/expired/);
  });
});

const E18 = 10n ** 18n;
const DAY = 86_400n;
const YEAR = 365n * DAY;
const EPOCH = 1_792_627_200n;
const NOW_IN_EPOCH = EPOCH + 3n * DAY;
const OWNER: Address = "0x00000000000000000000000000000000000000c1";
const HOUSE: Address = "0x00000000000000000000000000000000000000e0";
const GAUGE: Address = "0x00000000000000000000000000000000000000a1";

interface VeBtcFixture {
  readonly gauge: Address;
  readonly orderId: bigint;
}

/// 1713 holds the house gauge, 1714 bids as order 1, 1716 has no gauge and a closed order.
const VEBTC: ReadonlyMap<bigint, VeBtcFixture> = new Map([
  [1713n, { gauge: HOUSE, orderId: 0n }],
  [1714n, { gauge: GAUGE, orderId: 1n }],
  [1716n, { gauge: zeroAddress, orderId: 5n }],
]);

interface VeMezoFixture {
  readonly amount: bigint;
  readonly permanent: boolean;
  readonly vestingEnd: bigint;
  readonly lastVoted: bigint;
}

const VEMEZO: ReadonlyMap<bigint, VeMezoFixture> = new Map([
  [40n, { amount: 5n * E18, permanent: false, vestingEnd: 0n, lastVoted: 0n }],
  [41n, { amount: 5n * E18, permanent: true, vestingEnd: NOW_IN_EPOCH + DAY, lastVoted: EPOCH + DAY }],
  [42n, { amount: E18 / 2n, permanent: true, vestingEnd: 0n, lastVoted: 0n }],
]);

const id = (args: readonly unknown[], i = 0): bigint => args[i] as bigint;

function chain(veBtcIds: readonly bigint[], veMezoIds: readonly bigint[]) {
  const btc = (args: readonly unknown[]) => VEBTC.get(id(args));
  const mezo = (args: readonly unknown[]) => VEMEZO.get(id(args));
  return fakeClient({
    block: { number: 16_400_000n, timestamp: NOW_IN_EPOCH },
    balances: new Map([[OWNER, 5n * 10n ** 15n]]),
    reads: [
      onRead(mezoTokenContract, "balanceOf", () => 12n * E18),
      onRead(musdContract, "balanceOf", () => 67n * E18),
      onRead(musdContract, "allowance", (args) => (args[1] === marketContract.address ? 10n * E18 : 0n)),
      onRead(vaultContract, "balanceOf", () => 100n * E18),
      onRead(vaultContract, "claimable", () => 3n * E18),
      onRead(vaultContract, "rewardsClaimed", () => 0n),
      onRead(vaultContract, "minShardAmount", () => E18),
      onRead(veBtcContract, "balanceOf", () => BigInt(veBtcIds.length)),
      onRead(veBtcContract, "ownerToNFTokenIdList", (args) => veBtcIds[Number(id(args, 1))]),
      onRead(veBtcContract, "locked", () => ({ amount: 10n ** 13n, end: 0n, isPermanent: true, boost: E18 })),
      onRead(veBtcContract, "unboostedVotingPowerOfNFT", () => 10n ** 13n),
      onRead(voterContract, "getBoost", () => 2n * E18),
      onRead(voterContract, "boostableTokenIdToGauge", (args) => btc(args)?.gauge ?? GAUGE),
      onRead(voterContract, "weights", (args) => (args[0] === zeroAddress ? 0n : 7n * E18)),
      onRead(voterContract, "isAlive", (args) => args[0] !== zeroAddress),
      onRead(marketContract, "orderOfToken", (args) => btc(args)?.orderId ?? 0n),
      onRead(marketContract, "isActiveOrder", (args) => id(args) === 1n),
      onRead(veMezoContract, "balanceOf", () => BigInt(veMezoIds.length)),
      onRead(veMezoContract, "ownerToNFTokenIdList", (args) => veMezoIds[Number(id(args, 1))]),
      onRead(veMezoContract, "locked", (args) => ({
        amount: mezo(args)?.amount ?? 0n,
        end: mezo(args)?.permanent ? 0n : NOW_IN_EPOCH + YEAR,
        isPermanent: mezo(args)?.permanent ?? false,
        boost: 0n,
      })),
      onRead(veMezoContract, "votingPowerOfNFT", (args) => mezo(args)?.amount ?? 0n),
      onRead(veMezoContract, "escrowType", () => 0),
      onRead(veMezoContract, "vestingEnd", (args) => mezo(args)?.vestingEnd ?? 0n),
      onRead(voterContract, "lastVoted", (args) => mezo(args)?.lastVoted ?? 0n),
    ],
  });
}

describe("readAccountSnapshot", () => {
  it("reads balances, the MUSD allowance and the jMEZO position", async () => {
    const snapshot = await readAccountSnapshot(chain([], []), OWNER);
    expect(snapshot).toMatchObject({
      address: OWNER,
      btc: 5n * 10n ** 15n,
      mezo: 12n * E18,
      musd: 67n * E18,
      musdAllowance: 10n * E18,
      jmezo: 100n * E18,
      claimable: 3n * E18,
      claimed: 0n,
      veBtc: [],
      veMezo: [],
    });
  });

  it("reads each veBTC NFT with its gauge and only an active order", async () => {
    const { veBtc } = await readAccountSnapshot(chain([1713n, 1714n, 1716n], []), OWNER);
    expect(veBtc.map((nft) => [nft.id, nft.gauge, nft.gaugeAlive, nft.orderId])).toEqual([
      [1713n, HOUSE, true, 0n],
      [1714n, GAUGE, true, 1n],
      [1716n, undefined, false, 0n],
    ]);
    expect(veBtc[0]).toMatchObject({
      amount: 10n ** 13n,
      permanent: true,
      boostable: 10n ** 13n,
      appliedBoost: E18,
      liveBoost: 2n * E18,
      gaugeWeight: 7n * E18,
    });
  });

  it("reads each veMEZO NFT with why the vault would refuse it", async () => {
    const { veMezo } = await readAccountSnapshot(chain([], [40n, 41n, 42n]), OWNER);
    expect(veMezo.map((nft) => [nft.id, nft.votedThisEpoch, nft.blocker])).toEqual([
      [40n, false, undefined],
      [41n, true, "This lock is still vesting"],
      [42n, false, "Locks need at least the vault minimum"],
    ]);
    expect(veMezo[0]).toMatchObject({ amount: 5n * E18, end: NOW_IN_EPOCH + YEAR, permanent: false, power: 5n * E18 });
  });

  it("reads at most 50 NFTs of each kind", async () => {
    const many = Array.from({ length: 60 }, (_, i) => BigInt(2_000 + i));
    const { veBtc } = await readAccountSnapshot(chain(many, []), OWNER);
    expect(veBtc).toHaveLength(50);
    expect(veBtc[49]?.id).toBe(2_049n);
  });
});
