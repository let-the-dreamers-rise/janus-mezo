/// Snapshots real matsnet NFTs for the fork tests: the newest veMEZO NFTs a JanusVault could
/// accept and the newest veBTC NFTs that already have a live boost gauge. Pins the block so
/// the fork test is reproducible and Foundry can cache its RPC reads.
/// Usage: pnpm scan:nfts [maxVeMezo=100] [maxVeBtc=40] [scanDepth=600]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, type Address, type PublicClient } from "viem";
import { boostVoterAbi, votingEscrowAbi } from "../src/abi/mezo.js";
import { MEZO_MATSNET } from "../src/config/addresses.js";
import { mezoMatsnet } from "../src/config/chain.js";
import { epochStart } from "../src/lib/epochs.js";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../contracts/test/fork/data/matsnet-nfts.json");
const BATCH = 40;
const MIN_SHARD = 10n ** 18n;
const NORMAL = 0;

const arg = (index: number, fallback: number): number => {
  const value = Number(process.argv[index] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`argument ${index - 1} must be a positive integer`);
  return value;
};

type Read = { status: "success"; result: unknown } | { status: "failure"; error: Error };

function ok<T>(read: Read | undefined): T | undefined {
  return read?.status === "success" ? (read.result as T) : undefined;
}

interface Lock {
  amount: bigint;
  end: bigint;
  isPermanent: boolean;
}

interface VeMezoCandidate {
  id: bigint;
  owner: Address;
  power: bigint;
  permanent: boolean;
  delegatee: bigint;
  usedWeights: bigint;
}

interface VeBtcCandidate {
  id: bigint;
  owner: Address;
  gauge: Address;
}

async function scanVeMezo(
  client: PublicClient,
  ids: bigint[],
  blockNumber: bigint,
  now: bigint,
): Promise<VeMezoCandidate[]> {
  const ve = { address: MEZO_MATSNET.veMezo, abi: votingEscrowAbi } as const;
  const voter = { address: MEZO_MATSNET.boostVoter, abi: boostVoterAbi } as const;
  const perId = 8;
  const reads = await client.multicall({
    blockNumber,
    contracts: ids.flatMap((id) => [
      { ...ve, functionName: "ownerOf" as const, args: [id] as const },
      { ...ve, functionName: "escrowType" as const, args: [id] as const },
      { ...ve, functionName: "vestingEnd" as const, args: [id] as const },
      { ...ve, functionName: "locked" as const, args: [id] as const },
      { ...ve, functionName: "votingPowerOfNFT" as const, args: [id] as const },
      { ...ve, functionName: "delegates" as const, args: [id] as const },
      { ...voter, functionName: "lastVoted" as const, args: [id] as const },
      { ...voter, functionName: "usedWeights" as const, args: [id] as const },
    ]),
  });
  const epoch = epochStart(now);
  const found: VeMezoCandidate[] = [];
  ids.forEach((id, i) => {
    const r = reads.slice(i * perId, i * perId + perId) as Read[];
    const owner = ok<Address>(r[0]);
    const escrowType = ok<number>(r[1]);
    const vestingEnd = ok<bigint>(r[2]);
    const lock = ok<Lock>(r[3]);
    const power = ok<bigint>(r[4]);
    const delegatee = ok<bigint>(r[5]) ?? 0n;
    const lastVoted = ok<bigint>(r[6]);
    const usedWeights = ok<bigint>(r[7]) ?? 0n;
    if (!owner || owner === "0x0000000000000000000000000000000000000000") return;
    if (escrowType !== NORMAL || vestingEnd === undefined || vestingEnd > now) return;
    if (lastVoted === undefined || lastVoted >= epoch) return;
    if (!lock || lock.amount < MIN_SHARD) return;
    if (!lock.isPermanent && lock.end <= now) return;
    if (!power || power === 0n) return;
    found.push({ id, owner, power, permanent: lock.isPermanent, delegatee, usedWeights });
  });
  return found;
}

async function scanVeBtc(client: PublicClient, ids: bigint[], blockNumber: bigint): Promise<VeBtcCandidate[]> {
  const ve = { address: MEZO_MATSNET.veBtc, abi: votingEscrowAbi } as const;
  const voter = { address: MEZO_MATSNET.boostVoter, abi: boostVoterAbi } as const;
  const gauges = await client.multicall({
    blockNumber,
    contracts: ids.map((id) => ({ ...voter, functionName: "boostableTokenIdToGauge" as const, args: [id] as const })),
  });
  const withGauge = ids
    .map((id, i) => ({ id, gauge: ok<Address>(gauges[i] as Read) }))
    .filter((x): x is { id: bigint; gauge: Address } =>
      Boolean(x.gauge && x.gauge !== "0x0000000000000000000000000000000000000000"),
    );
  if (withGauge.length === 0) return [];
  const reads = await client.multicall({
    blockNumber,
    contracts: withGauge.flatMap(({ id, gauge }) => [
      { ...voter, functionName: "isAlive" as const, args: [gauge] as const },
      { ...ve, functionName: "ownerOf" as const, args: [id] as const },
      { ...ve, functionName: "unboostedVotingPowerOfNFT" as const, args: [id] as const },
    ]),
  });
  return withGauge.flatMap(({ id, gauge }, i) => {
    const alive = ok<boolean>(reads[i * 3] as Read);
    const owner = ok<Address>(reads[i * 3 + 1] as Read);
    const power = ok<bigint>(reads[i * 3 + 2] as Read);
    return alive && owner && power && power > 0n ? [{ id, owner, gauge }] : [];
  });
}

async function newest<T>(
  last: bigint,
  depth: number,
  max: number,
  scan: (ids: bigint[]) => Promise<T[]>,
): Promise<T[]> {
  const found: T[] = [];
  for (let top = last; top > 0n && last - top < BigInt(depth) && found.length < max; top -= BigInt(BATCH)) {
    const ids: bigint[] = [];
    for (let id = top; id > 0n && id > top - BigInt(BATCH); id--) ids.push(id);
    found.push(...(await scan(ids)));
  }
  return found.slice(0, max);
}

async function main(): Promise<void> {
  const [maxVeMezo, maxVeBtc, depth] = [arg(2, 100), arg(3, 40), arg(4, 600)];
  const client = createPublicClient({ chain: mezoMatsnet, transport: http(undefined, { timeout: 60_000 }) });
  const block = await client.getBlock();
  const at = { blockNumber: block.number };
  const [lastVeMezo, lastVeBtc] = await Promise.all([
    client.readContract({ ...at, address: MEZO_MATSNET.veMezo, abi: votingEscrowAbi, functionName: "tokenId" }),
    client.readContract({ ...at, address: MEZO_MATSNET.veBtc, abi: votingEscrowAbi, functionName: "tokenId" }),
  ]);
  // Strongest first, so the vault's first shard can carry many gauges in the gas profile.
  const veMezo = (
    await newest(lastVeMezo, depth, maxVeMezo, (ids) => scanVeMezo(client, ids, block.number, block.timestamp))
  ).sort((a, b) => (b.power > a.power ? 1 : b.power < a.power ? -1 : 0));
  const veBtc = await newest(lastVeBtc, depth, maxVeBtc, (ids) => scanVeBtc(client, ids, block.number));

  const record = {
    block: Number(block.number),
    timestamp: Number(block.timestamp),
    veMezoIds: veMezo.map((c) => Number(c.id)),
    veMezoOwners: veMezo.map((c) => c.owner),
    veMezoPower: veMezo.map((c) => c.power.toString()),
    veMezoPermanent: veMezo.map((c) => c.permanent),
    veMezoDelegated: veMezo.map((c) => c.delegatee > 0n),
    veMezoHasVotes: veMezo.map((c) => c.usedWeights > 0n),
    veBtcIds: veBtc.map((c) => Number(c.id)),
    veBtcOwners: veBtc.map((c) => c.owner),
    veBtcGauges: veBtc.map((c) => c.gauge),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(record, null, 2)}\n`);
  console.log(
    JSON.stringify({
      block: record.block,
      lastVeMezo: lastVeMezo.toString(),
      lastVeBtc: lastVeBtc.toString(),
      veMezo: veMezo.length,
      permanent: record.veMezoPermanent.filter(Boolean).length,
      delegated: record.veMezoDelegated.filter(Boolean).length,
      withVotes: record.veMezoHasVotes.filter(Boolean).length,
      veBtc: veBtc.length,
      out: OUT,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
