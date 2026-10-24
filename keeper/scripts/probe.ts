/// Read-only probe of the Mezo matsnet contracts Janus integrates with.
/// Usage: pnpm tsx scripts/probe.ts
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createPublicClient, formatEther, http } from "viem";
import { boostVoterAbi, erc20Abi, factoryRegistryAbi, votingEscrowAbi } from "../src/abi/mezo.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });
import { MEZO_MATSNET } from "../src/config/addresses.js";
import { mezoMatsnet } from "../src/config/chain.js";

const client = createPublicClient({ chain: mezoMatsnet, transport: http() });
const A = MEZO_MATSNET;

const read = <T>(p: Promise<T>): Promise<T | string> => p.catch((e: Error) => `ERR ${e.message.split("\n")[0]}`);

async function main(): Promise<void> {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const bv = { address: A.boostVoter, abi: boostVoterAbi } as const;
  const veMezo = { address: A.veMezo, abi: votingEscrowAbi } as const;
  const veBtc = { address: A.veBtc, abi: votingEscrowAbi } as const;
  const reg = { address: A.factoryRegistry, abi: factoryRegistryAbi } as const;

  const [ve, boostableVe, gaugeCount, maxVotingNum, totalWeight, epochStart, voteStart, voteEnd] = await Promise.all([
    read(client.readContract({ ...bv, functionName: "ve" })),
    read(client.readContract({ ...bv, functionName: "boostableVe" })),
    read(client.readContract({ ...bv, functionName: "length" })),
    read(client.readContract({ ...bv, functionName: "maxVotingNum" })),
    read(client.readContract({ ...bv, functionName: "totalWeight" })),
    read(client.readContract({ ...bv, functionName: "epochStart", args: [now] })),
    read(client.readContract({ ...bv, functionName: "epochVoteStart", args: [now] })),
    read(client.readContract({ ...bv, functionName: "epochVoteEnd", args: [now] })),
  ]);
  console.log("BoostVoter", { ve, boostableVe, gaugeCount, maxVotingNum, totalWeight, epochStart, voteStart, voteEnd, now });

  const gaugeFactories = await read(client.readContract({ ...reg, functionName: "gaugeFactories" }));
  console.log("FactoryRegistry.gaugeFactories", gaugeFactories);

  const [mezoToken, mezoTotal, mezoUnboosted, mezoSupply, mezoLastId, mezoVoter, mezoBooster, mezoTeam, bvIsSecondary] =
    await Promise.all([
      read(client.readContract({ ...veMezo, functionName: "token" })),
      read(client.readContract({ ...veMezo, functionName: "totalVotingPower" })),
      read(client.readContract({ ...veMezo, functionName: "unboostedTotalVotingPower" })),
      read(client.readContract({ ...veMezo, functionName: "supply" })),
      read(client.readContract({ ...veMezo, functionName: "tokenId" })),
      read(client.readContract({ ...veMezo, functionName: "voter" })),
      read(client.readContract({ ...veMezo, functionName: "booster" })),
      read(client.readContract({ ...veMezo, functionName: "team" })),
      read(client.readContract({ ...veMezo, functionName: "isSecondaryVoter", args: [A.boostVoter] })),
    ]);
  console.log("veMEZO", { mezoToken, mezoTotal, mezoUnboosted, mezoSupply, mezoLastId, mezoVoter, mezoBooster, mezoTeam, bvIsSecondary });

  const [btcToken, btcTotal, btcUnboosted, btcSupply, btcLastId, btcVoter, btcBooster] = await Promise.all([
    read(client.readContract({ ...veBtc, functionName: "token" })),
    read(client.readContract({ ...veBtc, functionName: "totalVotingPower" })),
    read(client.readContract({ ...veBtc, functionName: "unboostedTotalVotingPower" })),
    read(client.readContract({ ...veBtc, functionName: "supply" })),
    read(client.readContract({ ...veBtc, functionName: "tokenId" })),
    read(client.readContract({ ...veBtc, functionName: "voter" })),
    read(client.readContract({ ...veBtc, functionName: "booster" })),
  ]);
  console.log("veBTC", { btcToken, btcTotal, btcUnboosted, btcSupply, btcLastId, btcVoter, btcBooster });

  const count = typeof gaugeCount === "bigint" ? Number(gaugeCount) : 0;
  const gauges = await Promise.all(
    Array.from({ length: Math.min(count, 12) }, (_, i) =>
      read(client.readContract({ ...bv, functionName: "gauges", args: [BigInt(i)] })),
    ),
  );
  const gaugeWeights = await Promise.all(
    gauges.map((g) => (typeof g === "string" && g.startsWith("0x") ? read(client.readContract({ ...bv, functionName: "weights", args: [g as `0x${string}`] })) : "-")),
  );
  console.log("gauges", gauges.map((g, i) => ({ gauge: g, weight: gaugeWeights[i] })));

  const [musdName, musdDecimals, mezoSymbol, mezoDecimals] = await Promise.all([
    read(client.readContract({ address: A.musd, abi: erc20Abi, functionName: "name" })),
    read(client.readContract({ address: A.musd, abi: erc20Abi, functionName: "decimals" })),
    read(client.readContract({ address: A.mezoToken, abi: erc20Abi, functionName: "symbol" })),
    read(client.readContract({ address: A.mezoToken, abi: erc20Abi, functionName: "decimals" })),
  ]);
  console.log("tokens", { musdName, musdDecimals, mezoSymbol, mezoDecimals });

  const deployer = process.env.DEPLOYER_ADDRESS as `0x${string}` | undefined;
  if (deployer) {
    const [bal, mezoBal, musdBal] = await Promise.all([
      client.getBalance({ address: deployer }),
      read(client.readContract({ address: A.mezoToken, abi: erc20Abi, functionName: "balanceOf", args: [deployer] })),
      read(client.readContract({ address: A.musd, abi: erc20Abi, functionName: "balanceOf", args: [deployer] })),
    ]);
    console.log("deployer", { deployer, btc: formatEther(bal), mezo: mezoBal, musd: musdBal });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
