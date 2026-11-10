/// Creates and seeds the jMEZO/MUSD pool on Mezo's DEX.
/// Usage: pnpm pool status
///        pnpm pool create            create the pool and exclude it from jMEZO rewards
///        pnpm pool seed <jmezo> <musd>   add liquidity from the deployer wallet
/// Set JANUS_NETWORK=mainnet to act on mainnet. The pool and its fee vault must be excluded
/// from rewards while empty, so `create` always runs before any liquidity arrives.
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  http,
  parseAbi,
  parseEther,
  zeroAddress,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { janusVaultAbi } from "../src/abi/janus.js";
import { erc20Abi } from "../src/abi/mezo.js";
import { approveIfNeeded } from "../src/chain/tokens.js";
import { sendTx, type Signer } from "../src/chain/tx.js";
import { loadDeployment } from "../src/config/deployment.js";
import { loadSignerKey } from "../src/config/env.js";
import { selectNetwork } from "../src/config/networks.js";
import { minOut } from "../src/lib/pool.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const STABLE = false;
const SLIPPAGE_BPS = 100n;
const DEADLINE_SECONDS = 1_200n;

const routerAbi = parseAbi([
  "function defaultFactory() view returns (address)",
  "function poolFor(address tokenA, address tokenB, bool stable, address factory) view returns (address)",
  "function addLiquidity(address tokenA, address tokenB, bool stable, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256, uint256)",
]);
const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, bool stable) view returns (address)",
  "function createPool(address tokenA, address tokenB, bool stable) returns (address)",
]);
const poolAbi = parseAbi([
  "function poolFees() view returns (address)",
  "function token0() view returns (address)",
  "function getReserves() view returns (uint256, uint256, uint256)",
]);

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, ...data }, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)));

const network = selectNetwork(process.env.JANUS_NETWORK);
const deployment = loadDeployment(network.chain.id);
const publicClient = createPublicClient({ chain: network.chain, transport: http() });
const jmezo = deployment.vault;
const musd = deployment.musd;
const router = { address: network.dexRouter, abi: routerAbi } as const;

function signer(): Signer {
  const account = privateKeyToAccount(loadSignerKey(["DEPLOYER_PRIVATE_KEY"]));
  const walletClient = createWalletClient({ account, chain: network.chain, transport: http() });
  return { publicClient: publicClient as Signer["publicClient"], walletClient, log };
}

async function factory(): Promise<Address> {
  return publicClient.readContract({ ...router, functionName: "defaultFactory" });
}

async function findPool(): Promise<Address | undefined> {
  const pool = await publicClient.readContract({
    address: await factory(),
    abi: factoryAbi,
    functionName: "getPool",
    args: [jmezo, musd, STABLE],
  });
  return pool === zeroAddress ? undefined : pool;
}

const isExcluded = (account: Address) =>
  publicClient.readContract({ address: jmezo, abi: janusVaultAbi, functionName: "isExcluded", args: [account] });

const poolFees = (pool: Address) => publicClient.readContract({ address: pool, abi: poolAbi, functionName: "poolFees" });

async function exclude(wallet: Signer, account: Address, label: string): Promise<void> {
  if (await isExcluded(account)) return;
  const data = encodeFunctionData({ abi: janusVaultAbi, functionName: "excludeFromRewards", args: [account] });
  await sendTx(wallet, `exclude ${label}`, jmezo, data);
}

async function status(): Promise<void> {
  const pool = await findPool();
  if (!pool) return log("pool.missing", { chainId: network.chain.id, jmezo, musd });
  const [fees, token0, reserves] = await Promise.all([
    poolFees(pool),
    publicClient.readContract({ address: pool, abi: poolAbi, functionName: "token0" }),
    publicClient.readContract({ address: pool, abi: poolAbi, functionName: "getReserves" }),
  ]);
  const [jmezoReserve, musdReserve] = token0.toLowerCase() === jmezo.toLowerCase() ? reserves : [reserves[1], reserves[0]];
  log("pool", {
    pool,
    fees,
    poolExcluded: await isExcluded(pool),
    feesExcluded: await isExcluded(fees),
    jmezoReserve: formatEther(jmezoReserve),
    musdReserve: formatEther(musdReserve),
  });
}

async function create(): Promise<void> {
  const wallet = signer();
  // Excluded before it exists, so nobody can block this by sending jMEZO to the address first.
  const predicted = await publicClient.readContract({
    ...router,
    functionName: "poolFor",
    args: [jmezo, musd, STABLE, await factory()],
  });
  await exclude(wallet, predicted, "pool");
  if (!(await findPool())) {
    const data = encodeFunctionData({ abi: factoryAbi, functionName: "createPool", args: [jmezo, musd, STABLE] });
    await sendTx(wallet, "create pool", await factory(), data);
  }
  const pool = await findPool();
  if (pool !== predicted) throw new Error(`pool ${String(pool)} is not at the predicted ${predicted}`);
  await exclude(wallet, await poolFees(pool), "pool fees");
  await status();
}

async function seed(jmezoArg: string | undefined, musdArg: string | undefined): Promise<void> {
  if (!jmezoArg || !musdArg) throw new Error("usage: pnpm pool seed <jmezo> <musd>");
  const pool = await findPool();
  if (!pool || !(await isExcluded(pool)) || !(await isExcluded(await poolFees(pool)))) {
    throw new Error("run `pnpm pool create` first: the pool must be excluded before it holds jMEZO");
  }
  const wallet = signer();
  const to = wallet.walletClient.account.address;
  const [jmezoIn, musdIn] = [parseEther(jmezoArg), parseEther(musdArg)];
  for (const [token, amount, label] of [[jmezo, jmezoIn, "jMEZO"], [musd, musdIn, "MUSD"]] as const) {
    const balance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [to] });
    if (balance < amount) throw new Error(`need ${formatEther(amount)} ${label}, wallet holds ${formatEther(balance)}`);
    await approveIfNeeded(wallet, token, network.dexRouter, amount, `${label} for the router`);
  }
  const { timestamp } = await publicClient.getBlock();
  const data = encodeFunctionData({
    abi: routerAbi,
    functionName: "addLiquidity",
    args: [jmezo, musd, STABLE, jmezoIn, musdIn, minOut(jmezoIn, SLIPPAGE_BPS), minOut(musdIn, SLIPPAGE_BPS), to, timestamp + DEADLINE_SECONDS],
  });
  await sendTx(wallet, "add liquidity", network.dexRouter, data);
  await status();
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "status") return status();
  if (command === "create") return create();
  if (command === "seed") return seed(args[0], args[1]);
  throw new Error("usage: pnpm pool <status|create|seed>");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
