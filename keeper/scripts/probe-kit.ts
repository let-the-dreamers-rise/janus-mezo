/// Read-only probe for the starter kit: matsnet block time and gas estimates for each kit
/// call, sent from the faucet wallet. Usage: pnpm exec tsx scripts/probe-kit.ts
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, encodeFunctionData, http, isAddress, type Address } from "viem";
import { erc20Abi, votingEscrowAbi } from "../src/abi/mezo.js";
import { MEZO_MATSNET } from "../src/config/addresses.js";
import { mezoMatsnet } from "../src/config/chain.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const client = createPublicClient({ chain: mezoMatsnet, transport: http() });
const DAY = 86_400n;
const SAT = 10n ** 10n;

async function main(): Promise<void> {
  const faucet = process.env.FAUCET_ADDRESS;
  if (!faucet || !isAddress(faucet)) throw new Error("Set FAUCET_ADDRESS in the repo .env (pnpm wallet:new FAUCET)");
  const someone: Address = "0x000000000000000000000000000000000000dEaD";

  const latest = await client.getBlock();
  const earlier = await client.getBlock({ blockNumber: latest.number - 100n });
  const seconds = Number(latest.timestamp - earlier.timestamp) / 100;

  const calls = {
    musdTransfer: { to: MEZO_MATSNET.musd, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [someone, 10n ** 18n] }) },
    veBtcLockFor: {
      to: MEZO_MATSNET.veBtc,
      data: encodeFunctionData({ abi: votingEscrowAbi, functionName: "createLockFor", args: [100n * SAT, 28n * DAY, someone] }),
    },
  } as const;
  const estimates: Record<string, string> = {};
  for (const [name, call] of Object.entries(calls)) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      runs.push(await client.estimateGas({ account: faucet, ...call }).then(String, (e: Error) => `ERR ${e.message.split("\n")[0]}`));
    }
    estimates[name] = runs.join(", ");
  }
  console.log({ averageBlockSeconds: seconds, block: latest.number.toString(), estimates });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
