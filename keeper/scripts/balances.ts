/// Prints BTC, MEZO and MUSD balances plus the current gas price on matsnet.
/// Usage: pnpm exec tsx scripts/balances.ts [address]   (defaults to DEPLOYER_ADDRESS)
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createPublicClient, formatEther, formatGwei, http, isAddress, type Address } from "viem";
import { erc20Abi } from "../src/abi/mezo.js";
import { MEZO_MATSNET } from "../src/config/addresses.js";
import { mezoMatsnet } from "../src/config/chain.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

async function main(): Promise<void> {
  const candidate = process.argv[2] ?? process.env.DEPLOYER_ADDRESS;
  if (!candidate || !isAddress(candidate)) {
    throw new Error("Pass an address or set DEPLOYER_ADDRESS in the repo .env");
  }
  const who: Address = candidate;
  const client = createPublicClient({ chain: mezoMatsnet, transport: http() });
  const token = (address: Address) =>
    client.readContract({ address, abi: erc20Abi, functionName: "balanceOf", args: [who] });

  const [btc, mezo, musd, gasPrice, block] = await Promise.all([
    client.getBalance({ address: who }),
    token(MEZO_MATSNET.mezoToken),
    token(MEZO_MATSNET.musd),
    client.getGasPrice(),
    client.getBlock(),
  ]);

  console.log({
    address: who,
    btc: formatEther(btc),
    mezo: formatEther(mezo),
    musd: formatEther(musd),
    gasPriceGwei: formatGwei(gasPrice),
    blockGasLimit: block.gasLimit.toString(),
    blockNumber: block.number.toString(),
    blockTime: new Date(Number(block.timestamp) * 1000).toISOString(),
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
