/// One-time move of the deployer's own matsnet position from the v1 contracts to v2. Other
/// people's jMEZO and orders stay untouched in v1, where they can still redeem and cancel.
/// Usage: pnpm exec tsx scripts/migrate-v2.ts status
///        pnpm exec tsx scripts/migrate-v2.ts run
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, encodeFunctionData, formatEther, getAddress, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { boostMarketAbi, janusVaultAbi } from "../src/abi/janus.js";
import { votingEscrowAbi } from "../src/abi/mezo.js";
import { MATSNET_CHAIN_ID, mezoMatsnet } from "../src/config/chain.js";
import { loadDeployment } from "../src/config/deployment.js";
import { loadSignerKey } from "../src/config/env.js";
import { approveIfNeeded } from "../src/chain/tokens.js";
import { sendTx, type Signer } from "../src/chain/tx.js";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../.env") });

const V1 = JSON.parse(readFileSync(resolve(here, "../../contracts/deployments/31611.v1.json"), "utf8")) as { vault: Address; market: Address };
const SEED = JSON.parse(readFileSync(resolve(here, "../../contracts/deployments/31611.seed.json"), "utf8")) as {
  house: { gauge: Address };
  shards: string[];
};
const v2 = loadDeployment(MATSNET_CHAIN_ID);
const MIN_ESCROW = 10n ** 18n;

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, ...data }, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)));

const account = privateKeyToAccount(loadSignerKey(["DEPLOYER_PRIVATE_KEY"]));
const publicClient = createPublicClient({ chain: mezoMatsnet, transport: http() });
const signer: Signer = {
  publicClient: publicClient as Signer["publicClient"],
  walletClient: createWalletClient({ account, chain: mezoMatsnet, transport: http() }),
  log,
};
const me = account.address;
const v1Vault = { address: V1.vault, abi: janusVaultAbi } as const;
const v1Market = { address: V1.market, abi: boostMarketAbi } as const;

async function orders() {
  const ids = await publicClient.readContract({ ...v1Market, functionName: "activeOrderIds" });
  return Promise.all(
    ids.map(async (id) => ({ id, ...(await publicClient.readContract({ ...v1Market, functionName: "getOrder", args: [id] })) })),
  );
}

async function status(): Promise<void> {
  const [shards, supply, mine, claimable] = await Promise.all([
    publicClient.readContract({ ...v1Vault, functionName: "shardIds" }),
    publicClient.readContract({ ...v1Vault, functionName: "totalSupply" }),
    publicClient.readContract({ ...v1Vault, functionName: "balanceOf", args: [me] }),
    publicClient.readContract({ ...v1Vault, functionName: "claimable", args: [me] }),
  ]);
  log("v1.vault", { shards, supply: formatEther(supply), deployerJmezo: formatEther(mine), deployerClaimable: formatEther(claimable) });
  for (const o of await orders()) {
    log("v1.order", { id: o.id, mine: getAddress(o.owner) === me, owner: o.owner, tokenId: o.tokenId, escrow: formatEther(o.escrow) });
  }
}

async function moveShard(tokenId: bigint): Promise<void> {
  const owner = await publicClient.readContract({ address: v2.veMezo, abi: votingEscrowAbi, functionName: "ownerOf", args: [tokenId] });
  if (getAddress(owner) === getAddress(V1.vault)) {
    await sendTx(signer, `redeem shard ${tokenId} from v1`, V1.vault, encodeFunctionData({ abi: janusVaultAbi, functionName: "redeem", args: [tokenId] }));
  } else if (getAddress(owner) !== me) {
    log("shard.skipped", { tokenId, owner });
    return;
  }
  const data = encodeFunctionData({ abi: votingEscrowAbi, functionName: "safeTransferFrom", args: [me, v2.vault, tokenId] });
  await sendTx(signer, `deposit shard ${tokenId} into v2`, v2.veMezo, data);
}

async function moveOrders(): Promise<void> {
  for (const o of await orders()) {
    if (getAddress(o.owner) !== me) continue;
    await sendTx(signer, `cancel v1 order ${o.id}`, V1.market, encodeFunctionData({ abi: boostMarketAbi, functionName: "cancelOrder", args: [o.id] }));
    const escrow = o.escrow > 0n ? o.escrow : MIN_ESCROW;
    await approveIfNeeded(signer, v2.musd, v2.market, escrow, `MUSD for order on veBTC ${o.tokenId}`);
    const place = encodeFunctionData({ abi: boostMarketAbi, functionName: "placeOrder", args: [o.tokenId, o.pricePerVote, o.targetBoost, escrow] });
    await sendTx(signer, `place v2 order on veBTC ${o.tokenId}`, v2.market, place);
  }
}

async function run(): Promise<void> {
  const current = await publicClient.readContract({ address: v2.market, abi: boostMarketAbi, functionName: "fallbackGauge" });
  if (getAddress(current) !== getAddress(SEED.house.gauge)) {
    await sendTx(signer, "set fallback gauge", v2.market, encodeFunctionData({ abi: boostMarketAbi, functionName: "setFallbackGauge", args: [SEED.house.gauge] }));
  }
  await sendTx(signer, "claim v1 rewards", V1.vault, encodeFunctionData({ abi: janusVaultAbi, functionName: "claim" }));
  for (const id of SEED.shards) await moveShard(BigInt(id));
  await moveOrders();
  await status();
}

(process.argv[2] === "run" ? run() : status()).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
