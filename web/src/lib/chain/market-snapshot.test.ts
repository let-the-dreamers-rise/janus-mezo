import { zeroAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { fakeClient, onRead } from "@/test/fake-client";
import { marketContract, vaultContract, veBtcContract, veMezoContract, voterContract } from "./contracts";
import { readMarketSnapshot } from "./market-snapshot";

const E18 = 10n ** 18n;
const DAY = 86_400n;
const WEEK = 7n * DAY;
const EPOCH = 1_792_627_200n;
const POWER = 33n * E18;
const BUYER: Address = "0x00000000000000000000000000000000000000b1";
const GAUGE_A: Address = "0x00000000000000000000000000000000000000a1";
const GAUGE_B: Address = "0x00000000000000000000000000000000000000a2";
const HOUSE: Address = "0x00000000000000000000000000000000000000e0";

interface Order {
  readonly owner: Address;
  readonly tokenId: bigint;
  readonly pricePerVote: bigint;
  readonly targetBoost: bigint;
  readonly escrow: bigint;
}

interface Nft {
  readonly gauge: Address;
  readonly boostable: bigint;
  readonly applied: bigint;
  readonly live: bigint;
}

interface Scenario {
  readonly now: bigint;
  readonly roundId: bigint;
  readonly roundEpoch: bigint;
  readonly shardIds: readonly bigint[];
  readonly lastVoted: (shardId: bigint) => bigint;
  readonly roundPowers: readonly bigint[];
  readonly orderIds: readonly bigint[];
  readonly orders: ReadonlyMap<bigint, Order>;
  readonly nfts: ReadonlyMap<bigint, Nft>;
}

const order = (tokenId: bigint, pricePerVote: bigint, escrow: bigint): Order => ({
  owner: BUYER,
  tokenId,
  pricePerVote,
  targetBoost: 5n * E18,
  escrow,
});

/// The seeded matsnet demo after round 1: three shards that all voted this epoch and two
/// bids, the second of which drifted past the poke tolerance.
const DEMO: Scenario = {
  now: EPOCH + 3n * DAY,
  roundId: 1n,
  roundEpoch: EPOCH,
  shardIds: [930n, 931n, 932n],
  lastVoted: () => EPOCH + DAY,
  roundPowers: [POWER, POWER, POWER],
  orderIds: [1n, 2n],
  orders: new Map([
    [1n, order(1714n, 5n * 10n ** 16n, 2_620_100_000_000_000_000n)],
    [2n, order(1715n, 3n * 10n ** 16n, 4_860_200_000_000_000_000n)],
  ]),
  nfts: new Map([
    [1714n, { gauge: GAUGE_A, boostable: 10n ** 13n, applied: 5n * E18, live: 5n * E18 }],
    [1715n, { gauge: GAUGE_B, boostable: 2n * 10n ** 13n, applied: 2_816_700_000_000_000_000n, live: 2_840_000_000_000_000_000n }],
  ]),
};

/// Gauge weights are mostly the vault's own votes, as on matsnet: 3 shards x 10 on A plus one
/// outside vote, and 3 shards x 12 on B.
const WEIGHTS: ReadonlyMap<Address, bigint> = new Map([
  [GAUGE_A, 31n * E18],
  [GAUGE_B, 36n * E18],
]);
/// What each vault shard still holds on a gauge from its last vote.
const SHARD_VOTES: ReadonlyMap<Address, bigint> = new Map([
  [GAUGE_A, 10n * E18],
  [GAUGE_B, 12n * E18],
]);
const FILLS: ReadonlyMap<bigint, readonly [Address, bigint, bigint, bigint]> = new Map([
  [1n, [GAUGE_A, 52n * E18, 5n * 10n ** 16n, 2_600_000_000_000_000_000n]],
  [2n, [GAUGE_B, 47n * E18, 3n * 10n ** 16n, 1_410_000_000_000_000_000n]],
]);

const id = (args: readonly unknown[], i = 0): bigint => args[i] as bigint;
const gaugeArg = (args: readonly unknown[], i = 0): Address => args[i] as Address;

function chain(s: Scenario) {
  const nft = (args: readonly unknown[]) => s.nfts.get(id(args));
  const roundInfo = { epoch: s.roundEpoch, startedAt: s.roundEpoch + DAY, phase: 0, cursor: 0, maxGauges: 0, fallbackGauge: HOUSE, supply: 99n * E18, filled: 99n * E18 };
  return fakeClient({
    block: { number: 16_400_000n, timestamp: s.now },
    reads: [
      onRead(marketContract, "currentRound", () => [s.roundId, roundInfo]),
      onRead(marketContract, "activeOrderIds", () => s.orderIds),
      onRead(marketContract, "minPricePerVote", () => 10n ** 15n),
      onRead(marketContract, "feeBps", () => 1_000n),
      onRead(marketContract, "fallbackGauge", () => HOUSE),
      onRead(marketContract, "ROUND_TIMEOUT", () => 43_200n),
      onRead(marketContract, "MAX_ACTIVE_ORDERS", () => 32n),
      onRead(marketContract, "getOrder", (args) => s.orders.get(id(args))),
      onRead(marketContract, "roundOrders", () => s.orderIds),
      onRead(marketContract, "roundShards", () => s.shardIds),
      onRead(marketContract, "roundPowers", () => s.roundPowers),
      onRead(marketContract, "fills", (args) => FILLS.get(id(args, 1)) ?? [zeroAddress, 0n, 0n, 0n]),
      onRead(vaultContract, "totalSupply", () => 99n * E18),
      onRead(vaultContract, "shardIds", () => s.shardIds),
      onRead(vaultContract, "totalRewards", () => 3_643_200_000_000_000_000n),
      onRead(vaultContract, "minShardAmount", () => E18),
      onRead(vaultContract, "MAX_SHARDS", () => 100n),
      onRead(vaultContract, "shardAmount", () => POWER),
      onRead(veMezoContract, "totalVotingPower", () => 1_000n * E18),
      onRead(veMezoContract, "votingPowerOfNFT", () => POWER),
      onRead(veBtcContract, "unboostedTotalVotingPower", () => 10n ** 16n),
      onRead(veBtcContract, "ownerOf", (args) => {
        if (!nft(args)) throw new Error("ERC721: invalid token ID");
        return BUYER;
      }),
      onRead(veBtcContract, "unboostedVotingPowerOfNFT", (args) => nft(args)?.boostable ?? 0n),
      onRead(veBtcContract, "locked", (args) => ({ amount: 10n ** 13n, end: 0n, isPermanent: true, boost: nft(args)?.applied ?? 0n })),
      onRead(voterContract, "lastVoted", (args) => s.lastVoted(id(args))),
      onRead(voterContract, "usedWeights", () => POWER),
      onRead(voterContract, "boostableTokenIdToGauge", (args) => nft(args)?.gauge ?? zeroAddress),
      onRead(voterContract, "getBoost", (args) => nft(args)?.live ?? E18),
      onRead(voterContract, "weights", (args) => (gaugeArg(args) === zeroAddress ? 0n : WEIGHTS.get(gaugeArg(args)) ?? E18)),
      onRead(voterContract, "isAlive", (args) => gaugeArg(args) !== zeroAddress),
      onRead(voterContract, "votes", (args) => SHARD_VOTES.get(gaugeArg(args, 1)) ?? 0n),
    ],
  });
}

describe("readMarketSnapshot", () => {
  it("reads the round, the vault and every bid with its last fill", async () => {
    const snapshot = await readMarketSnapshot(chain(DEMO));
    expect(snapshot.now).toBe(DEMO.now);
    expect(snapshot.round).toMatchObject({ id: 1n, epoch: EPOCH, startedAt: EPOCH + DAY, phase: 0, fallbackGauge: HOUSE });
    expect(snapshot.roundShardCount).toBe(3);
    expect(snapshot.roundOrderIds).toEqual([1n, 2n]);
    expect(snapshot.vault).toMatchObject({ supply: 99n * E18, votingPower: 3n * POWER, maxShards: 100n });
    expect(snapshot.vault.shards.map((shard) => shard.eligible)).toEqual([false, false, false]);
    expect(snapshot.orders.map((o) => [o.orderId, o.tokenId, o.gauge, o.nftOwner])).toEqual([
      [1n, 1714n, GAUGE_A, BUYER],
      [2n, 1715n, GAUGE_B, BUYER],
    ]);
    expect(snapshot.orders[0]?.lastFill).toEqual({ gauge: GAUGE_A, votes: 52n * E18, pricePerVote: 5n * 10n ** 16n, charged: 2_600_000_000_000_000_000n });
    expect(snapshot.orders[0]?.gaugeWeight).toBe(31n * E18);
  });

  it("lists only boosts that drifted past the poke tolerance", async () => {
    const snapshot = await readMarketSnapshot(chain(DEMO));
    expect(snapshot.staleBoostIds).toEqual([1715n]);
  });

  it("projects next epoch's round, without the vault's own votes, once every shard has voted", async () => {
    const snapshot = await readMarketSnapshot(chain(DEMO));
    expect(snapshot.projectionScope).toBe("next-epoch");
    expect(snapshot.projectedSupply).toBe(3n * POWER);
    expect(snapshot.projectionExact).toBe(true);
    expect(snapshot.projection.map((p) => [p.entry.orderId, p.entry.gaugeWeight])).toEqual([
      [1n, E18],
      [2n, 0n],
    ]);
    expect(snapshot.signals).toMatchObject({ hasEligibleShards: false, hasStaleVotes: false, roundTimeout: 43_200n });
  });

  it("sells every shard and flags their old votes once a new epoch opens", async () => {
    const snapshot = await readMarketSnapshot(chain({ ...DEMO, now: EPOCH + WEEK + 2n * DAY }));
    expect(snapshot.vault.shards.every((shard) => shard.eligible)).toBe(true);
    expect(snapshot.projectionScope).toBe("this-epoch");
    expect(snapshot.projectedSupply).toBe(3n * POWER);
    expect(snapshot.signals).toMatchObject({ hasEligibleShards: true, hasStaleVotes: true, hasDemand: true });
  });

  it("stops counting a shard this epoch's round recorded at zero power", async () => {
    const snapshot = await readMarketSnapshot(
      chain({ ...DEMO, lastVoted: (shard) => (shard === 932n ? EPOCH - DAY : EPOCH + DAY), roundPowers: [POWER, POWER, 0n] }),
    );
    expect(snapshot.vault.shards.find((shard) => shard.id === 932n)?.eligible).toBe(true);
    expect(snapshot.signals).toMatchObject({ hasEligibleShards: false, hasStaleVotes: false });
    expect(snapshot.projectionScope).toBe("next-epoch");
  });

  it("reads an empty market before its first round", async () => {
    const snapshot = await readMarketSnapshot(
      chain({ ...DEMO, roundId: 0n, roundEpoch: 0n, shardIds: [], orderIds: [], roundPowers: [] }),
    );
    expect(snapshot.round.id).toBe(0n);
    expect(snapshot.roundShardCount).toBe(0);
    expect(snapshot.orders).toEqual([]);
    expect(snapshot.projection).toEqual([]);
    expect(snapshot.projectionScope).toBe("this-epoch");
    expect(snapshot.vault.votingPower).toBe(0n);
    expect(snapshot.signals).toMatchObject({ hasEligibleShards: false, hasStaleVotes: false, hasDemand: false });
  });

  it("marks a bid on a burned NFT without a gauge as ineligible", async () => {
    const orders = new Map([...DEMO.orders, [3n, order(99n, 6n * 10n ** 16n, E18)]]);
    const snapshot = await readMarketSnapshot(chain({ ...DEMO, orderIds: [1n, 2n, 3n], orders }));
    expect(snapshot.orders.find((o) => o.orderId === 3n)).toMatchObject({ nftOwner: undefined, gauge: undefined, gaugeAlive: false });
    expect(snapshot.projection.find((p) => p.entry.orderId === 3n)?.status).toBe("ineligible");
  });

  it("skips subtracting carried votes when there are too many pairs to read", async () => {
    const ids = Array.from({ length: 39 }, (_, i) => BigInt(i + 1));
    const gaugeOf = (n: bigint): Address => `0x${(0xa000n + n).toString(16).padStart(40, "0")}`;
    const snapshot = await readMarketSnapshot(
      chain({
        ...DEMO,
        now: EPOCH + WEEK + 2n * DAY,
        shardIds: ids,
        orderIds: ids,
        orders: new Map(ids.map((n) => [n, order(5_000n + n, 5n * 10n ** 16n, E18)])),
        nfts: new Map(ids.map((n) => [5_000n + n, { gauge: gaugeOf(n), boostable: 10n ** 13n, applied: E18, live: E18 }])),
      }),
    );
    expect(snapshot.projectionExact).toBe(false);
    expect(snapshot.projection.every((p) => p.entry.gaugeWeight === E18)).toBe(true);
  });
});
