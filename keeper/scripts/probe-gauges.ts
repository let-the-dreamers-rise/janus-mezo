/// Finds recent boost gauges on matsnet and the gauge factory that created them.
/// Usage: pnpm tsx scripts/probe-gauges.ts
import { createPublicClient, http } from "viem";
import { boostVoterAbi, factoryRegistryAbi, gaugeAbi } from "../src/abi/mezo.js";
import { MEZO_MATSNET } from "../src/config/addresses.js";
import { mezoMatsnet } from "../src/config/chain.js";

const client = createPublicClient({ chain: mezoMatsnet, transport: http() });
const A = MEZO_MATSNET;
const CHUNK = 10_000n;
const MAX_CHUNKS = 60;

async function main(): Promise<void> {
  const head = await client.getBlockNumber();
  console.log("head block", head);

  const boostCreated: { tokenId: bigint; gauge: `0x${string}`; block: bigint }[] = [];
  for (let i = 0; i < MAX_CHUNKS && boostCreated.length < 5; i++) {
    const toBlock = head - CHUNK * BigInt(i);
    const fromBlock = toBlock - CHUNK + 1n;
    const logs = await client.getContractEvents({
      address: A.boostVoter,
      abi: boostVoterAbi,
      eventName: "BoostGaugeCreated",
      fromBlock,
      toBlock,
    });
    for (const log of logs) {
      boostCreated.push({ tokenId: log.args.boostableTokenId!, gauge: log.args.gauge!, block: log.blockNumber });
      if (boostCreated.length <= 2) {
        const tx = await client.getTransaction({ hash: log.transactionHash });
        console.log("creator tx", { hash: tx.hash, from: tx.from, to: tx.to, selector: tx.input.slice(0, 10), gaugeFactoryArg: `0x${tx.input.slice(34, 74)}` });
      }
    }
  }
  console.log("recent BoostGaugeCreated", boostCreated);

  for (const { gauge, tokenId } of boostCreated.slice(0, 3)) {
    const g = { address: gauge, abi: gaugeAbi } as const;
    const [factory, beneficiary, mapped, boost] = await Promise.all([
      client.readContract({ ...g, functionName: "factory" }).catch(() => "n/a"),
      client.readContract({ ...g, functionName: "beneficiary" }).catch(() => "n/a"),
      client.readContract({ address: A.boostVoter, abi: boostVoterAbi, functionName: "boostableTokenIdToGauge", args: [tokenId] }),
      client.readContract({ address: A.boostVoter, abi: boostVoterAbi, functionName: "getBoost", args: [tokenId] }),
    ]);
    console.log("gauge", { gauge, tokenId, factory, beneficiary, mapped, boost });
  }

  const factories = await client.readContract({ address: A.factoryRegistry, abi: factoryRegistryAbi, functionName: "gaugeFactories" });
  for (const f of factories) {
    const [code, rewardsFactory] = await Promise.all([
      client.getCode({ address: f }),
      client.readContract({ address: A.factoryRegistry, abi: factoryRegistryAbi, functionName: "gaugeFactoryToVotingRewardsFactory", args: [f] }),
    ]);
    console.log("factory", { factory: f, codeBytes: code ? (code.length - 2) / 2 : 0, rewardsFactory });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
