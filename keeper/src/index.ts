/// Janus keeper: drives BoostMarket rounds on matsnet. Every call it makes is
/// permissionless, so anyone can run this with any funded key.
/// Usage: pnpm start            run until the market rests, then exit
///        pnpm watch            keep running, checking every KEEPER_INTERVAL_SECONDS
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MATSNET_CHAIN_ID, mezoMatsnet } from "./config/chain.js";
import { loadDeployment } from "./config/deployment.js";
import { drive, type Keeper, type Logger } from "./round.js";
import { loadSignerKey } from "./config/env.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const log: Logger = (event, data = {}) =>
  console.log(
    JSON.stringify({ t: new Date().toISOString(), event, ...data }, (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function main(): Promise<void> {
  const watch = process.argv.includes("--watch");
  const intervalSeconds = positiveInteger("KEEPER_INTERVAL_SECONDS", 300);
  const batchSize = BigInt(positiveInteger("KEEPER_BATCH_SIZE", 10));
  // Every send pads its estimate by half again, capped at 9.5M of the 10M block, so a batch
  // estimated at the 6M default still goes out with its full margin.
  const gasBudget = BigInt(positiveInteger("KEEPER_GAS_BUDGET", 6_000_000));
  const deployment = loadDeployment(MATSNET_CHAIN_ID);
  const account = privateKeyToAccount(loadSignerKey(["KEEPER_PRIVATE_KEY", "DEPLOYER_PRIVATE_KEY"]));

  const keeper: Keeper = {
    publicClient: createPublicClient({ chain: mezoMatsnet, transport: http() }),
    walletClient: createWalletClient({ account, chain: mezoMatsnet, transport: http() }),
    contracts: {
      vault: deployment.vault,
      market: deployment.market,
      boostVoter: deployment.boostVoter,
      veBtc: deployment.veBtc,
    },
    batchSize,
    gasBudget,
    log,
  };
  log("keeper.start", { keeper: account.address, market: deployment.market, watch, batchSize, gasBudget });

  do {
    try {
      const rest = await drive(keeper);
      log("keeper.rest", { action: rest });
    } catch (error) {
      log("keeper.error", { message: error instanceof Error ? error.message : String(error) });
      if (!watch) throw error;
    }
    if (watch) await sleep(intervalSeconds * 1000);
  } while (watch);
}

main().catch(() => {
  process.exit(1);
});
