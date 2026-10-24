import { zeroAddress, type Address, type PublicClient } from "viem";
import { epochStart } from "@/lib/protocol/keeper/epochs";
import {
  marketContract,
  mezoTokenContract,
  musdContract,
  vaultContract,
  veBtcContract,
  veMezoContract,
  voterContract,
} from "./contracts";

const MAX_NFTS = 50;
const NORMAL_ESCROW = 0;

export interface VeBtcNft {
  readonly id: bigint;
  readonly amount: bigint;
  readonly end: bigint;
  readonly permanent: boolean;
  /// Unboosted voting power: what the boost formula prices.
  readonly boostable: bigint;
  readonly appliedBoost: bigint;
  readonly liveBoost: bigint;
  readonly gauge: Address | undefined;
  readonly gaugeAlive: boolean;
  readonly gaugeWeight: bigint;
  /// Active Janus order for this NFT, 0 when none.
  readonly orderId: bigint;
}

export interface VeMezoNft {
  readonly id: bigint;
  readonly amount: bigint;
  readonly end: bigint;
  readonly permanent: boolean;
  readonly power: bigint;
  readonly votedThisEpoch: boolean;
  /// Why JanusVault would reject this lock, or undefined when it can be deposited.
  readonly blocker: string | undefined;
}

export interface AccountSnapshot {
  readonly address: Address;
  readonly btc: bigint;
  readonly mezo: bigint;
  readonly musd: bigint;
  readonly musdAllowance: bigint;
  readonly jmezo: bigint;
  readonly claimable: bigint;
  readonly claimed: bigint;
  readonly veBtc: readonly VeBtcNft[];
  readonly veMezo: readonly VeMezoNft[];
}

interface LockInput {
  readonly escrowType: number;
  readonly vestingEnd: bigint;
  readonly amount: bigint;
  readonly end: bigint;
  readonly permanent: boolean;
}

/// Mirrors JanusVault._registerShard, so the app explains a rejection before anyone signs.
export function depositBlocker(lock: LockInput, now: bigint, minShardAmount: bigint): string | undefined {
  if (lock.escrowType !== NORMAL_ESCROW) return "Only normal veMEZO locks can join the vault";
  if (lock.vestingEnd > now) return "This lock is still vesting";
  if (lock.amount <= 0n) return "This lock is empty";
  if (lock.amount < minShardAmount) return "Locks need at least the vault minimum";
  if (!lock.permanent && lock.end <= now) return "This lock has expired";
  return undefined;
}

async function ownedIds(client: PublicClient, blockNumber: bigint, escrow: typeof veBtcContract, owner: Address) {
  const count = await client.readContract({ ...escrow, functionName: "balanceOf", args: [owner], blockNumber });
  const n = Number(count > BigInt(MAX_NFTS) ? BigInt(MAX_NFTS) : count);
  if (n === 0) return [] as bigint[];
  return client.multicall({
    blockNumber,
    allowFailure: false,
    contracts: Array.from({ length: n }, (_, i) => ({
      ...escrow,
      functionName: "ownerToNFTokenIdList" as const,
      args: [owner, BigInt(i)] as const,
    })),
  });
}

async function readVeBtc(client: PublicClient, blockNumber: bigint, owner: Address): Promise<VeBtcNft[]> {
  const ids = await ownedIds(client, blockNumber, veBtcContract, owner);
  if (ids.length === 0) return [];
  const at = { blockNumber, allowFailure: false } as const;
  const [locks, boostable, liveBoosts, gauges, orderIds] = await Promise.all([
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...veBtcContract, functionName: "locked" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...veBtcContract, functionName: "unboostedVotingPowerOfNFT" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...voterContract, functionName: "getBoost" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...voterContract, functionName: "boostableTokenIdToGauge" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...marketContract, functionName: "orderOfToken" as const, args: [id] as const })) }),
  ]);
  const [weights, alive, active] = await Promise.all([
    client.multicall({ ...at, contracts: gauges.map((gauge) => ({ ...voterContract, functionName: "weights" as const, args: [gauge] as const })) }),
    client.multicall({ ...at, contracts: gauges.map((gauge) => ({ ...voterContract, functionName: "isAlive" as const, args: [gauge] as const })) }),
    client.multicall({ ...at, contracts: orderIds.map((id) => ({ ...marketContract, functionName: "isActiveOrder" as const, args: [id] as const })) }),
  ]);
  return ids.map((id, i) => {
    const lock = locks[i];
    const gauge = gauges[i] && gauges[i] !== zeroAddress ? gauges[i] : undefined;
    return {
      id,
      amount: lock ? BigInt(lock.amount) : 0n,
      end: lock?.end ?? 0n,
      permanent: lock?.isPermanent ?? false,
      boostable: boostable[i] ?? 0n,
      appliedBoost: lock?.boost ?? 0n,
      liveBoost: liveBoosts[i] ?? 0n,
      gauge,
      gaugeAlive: Boolean(gauge) && Boolean(alive[i]),
      gaugeWeight: weights[i] ?? 0n,
      orderId: active[i] ? orderIds[i] ?? 0n : 0n,
    };
  });
}

async function readVeMezo(
  client: PublicClient,
  blockNumber: bigint,
  owner: Address,
  now: bigint,
  minShardAmount: bigint,
): Promise<VeMezoNft[]> {
  const ids = await ownedIds(client, blockNumber, veMezoContract, owner);
  if (ids.length === 0) return [];
  const at = { blockNumber, allowFailure: false } as const;
  const [locks, powers, escrowTypes, vestingEnds, lastVoted] = await Promise.all([
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...veMezoContract, functionName: "locked" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...veMezoContract, functionName: "votingPowerOfNFT" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...veMezoContract, functionName: "escrowType" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...veMezoContract, functionName: "vestingEnd" as const, args: [id] as const })) }),
    client.multicall({ ...at, contracts: ids.map((id) => ({ ...voterContract, functionName: "lastVoted" as const, args: [id] as const })) }),
  ]);
  const start = epochStart(now);
  return ids.map((id, i) => {
    const lock = locks[i];
    const amount = lock ? BigInt(lock.amount) : 0n;
    const end = lock?.end ?? 0n;
    const permanent = lock?.isPermanent ?? false;
    return {
      id,
      amount,
      end,
      permanent,
      power: powers[i] ?? 0n,
      votedThisEpoch: (lastVoted[i] ?? 0n) >= start,
      blocker: depositBlocker(
        { escrowType: escrowTypes[i] ?? 0, vestingEnd: vestingEnds[i] ?? 0n, amount, end, permanent },
        now,
        minShardAmount,
      ),
    };
  });
}

export async function readAccountSnapshot(client: PublicClient, address: Address): Promise<AccountSnapshot> {
  const block = await client.getBlock();
  const blockNumber = block.number;
  const [btc, [mezo, musd, musdAllowance, jmezo, claimable, claimed, minShardAmount]] = await Promise.all([
    client.getBalance({ address, blockNumber }),
    client.multicall({
      blockNumber,
      allowFailure: false,
      contracts: [
        { ...mezoTokenContract, functionName: "balanceOf", args: [address] },
        { ...musdContract, functionName: "balanceOf", args: [address] },
        { ...musdContract, functionName: "allowance", args: [address, marketContract.address] },
        { ...vaultContract, functionName: "balanceOf", args: [address] },
        { ...vaultContract, functionName: "claimable", args: [address] },
        { ...vaultContract, functionName: "rewardsClaimed", args: [address] },
        { ...vaultContract, functionName: "minShardAmount" },
      ],
    }),
  ]);
  const [veBtc, veMezo] = await Promise.all([
    readVeBtc(client, blockNumber, address),
    readVeMezo(client, blockNumber, address, block.timestamp, minShardAmount),
  ]);
  return { address, btc, mezo, musd, musdAllowance, jmezo, claimable, claimed, veBtc, veMezo };
}
