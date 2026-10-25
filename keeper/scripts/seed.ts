/// Seeds the Janus demo on matsnet from the deployer wallet. Every step records what it
/// created in contracts/deployments/31611.seed.json, so reruns skip finished work.
/// Usage: pnpm seed <command>
///   status                    balances, NFTs, orders and the current round
///   quote [btc]               wallet balances and DEX quotes for BTC to MUSD and to MEZO
///   swap [btc]                swap BTC for MUSD on the Mezo DEX (default 0.002 BTC)
///   swap-mezo [btc]           swap BTC for MEZO on the Mezo DEX, for veMEZO shards
///   vemezo [locks]            lock all MEZO into veMEZO NFTs and deposit them (default 3)
///   deposit <tokenId>         deposit a veMEZO NFT the wallet already holds into the vault
///   house [sats]              lock BTC into the house veBTC NFT and make its gauge the fallback
///   buyer <label> <sats> <price>  lock BTC into a buyer veBTC NFT with a gauge and an order
import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  http,
  parseEther,
  parseEventLogs,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { boostMarketAbi, janusVaultAbi } from "../src/abi/janus.js";
import { boostVoterAbi, erc20Abi, votingEscrowAbi } from "../src/abi/mezo.js";
import { MEZO_MATSNET } from "../src/config/addresses.js";
import { MATSNET_CHAIN_ID, mezoMatsnet } from "../src/config/chain.js";
import { loadDeployment, type JanusDeployment } from "../src/config/deployment.js";
import { loadSignerKey } from "../src/config/env.js";
import { ROUTES, hop, quoteRoute, swapBtc, type Route } from "../src/chain/dex.js";
import { approveIfNeeded, mintedTokenId } from "../src/chain/tokens.js";
import { sendTx, type Signer } from "../src/chain/tx.js";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../.env") });

const SATOSHI = 10n ** 10n;
const TARGET_BOOST = 5n * 10n ** 18n;
const VEMEZO_LOCK = 208n * 7n * 24n * 3600n;
const VEBTC_LOCK = 7n * 24n * 3600n;
const STATE_PATH = resolve(here, `../../contracts/deployments/${MATSNET_CHAIN_ID}.seed.json`);

interface SeededNft {
  readonly tokenId: string;
  readonly gauge: Address;
}
interface SeededBuyer extends SeededNft {
  readonly label: string;
  readonly orderId: string;
}
interface SeedState {
  readonly house?: SeededNft;
  readonly buyers: readonly SeededBuyer[];
  readonly shards: readonly string[];
}

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, ...data }, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)));

function readState(): SeedState {
  if (!existsSync(STATE_PATH)) return { buyers: [], shards: [] };
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as SeedState;
}

function writeState(state: SeedState): void {
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function makeSigner(): Signer {
  const account = privateKeyToAccount(loadSignerKey(["DEPLOYER_PRIVATE_KEY"]));
  return {
    publicClient: createPublicClient({ chain: mezoMatsnet, transport: http() }),
    walletClient: createWalletClient({ account, chain: mezoMatsnet, transport: http() }),
    log,
  };
}

const me = (signer: Signer): Address => signer.walletClient.account.address;

async function quote(signer: Signer, btcAmount: string): Promise<void> {
  const amountIn = parseEther(btcAmount);
  const who = me(signer);
  const balanceOf = (token: Address) =>
    signer.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [who] });
  const [btc, mezo, musd] = await Promise.all([
    signer.publicClient.getBalance({ address: who }),
    balanceOf(MEZO_MATSNET.mezoToken),
    balanceOf(MEZO_MATSNET.musd),
  ]);
  log("wallet", { address: who, btc: formatEther(btc), mezo: formatEther(mezo), musd: formatEther(musd) });
  const candidates: Record<string, Route> = {
    "btc-musd volatile": ROUTES.musd,
    "btc-musd stable": [hop(MEZO_MATSNET.btcToken, MEZO_MATSNET.musd, true)],
    "btc-mezo volatile": ROUTES.mezo,
    "btc-mezo stable": [hop(MEZO_MATSNET.btcToken, MEZO_MATSNET.mezoToken, true)],
    "btc-musd-mezo": [hop(MEZO_MATSNET.btcToken, MEZO_MATSNET.musd), hop(MEZO_MATSNET.musd, MEZO_MATSNET.mezoToken)],
  };
  for (const [name, route] of Object.entries(candidates)) {
    const out = await quoteRoute(signer.publicClient, amountIn, route);
    log("quote", { route: name, btcIn: btcAmount, out: out === null ? "no liquidity" : formatEther(out) });
  }
}

async function swap(signer: Signer, btcAmount: string, to: "musd" | "mezo" = "musd"): Promise<void> {
  const quoted = await swapBtc(signer, parseEther(btcAmount), ROUTES[to], `swap ${btcAmount} BTC for ${to.toUpperCase()}`);
  log("swap.done", { to, quoted: formatEther(quoted) });
}

async function veMezoLocks(signer: Signer, dep: JanusDeployment, locks: number): Promise<void> {
  const balance = await signer.publicClient.readContract({
    address: MEZO_MATSNET.mezoToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [me(signer)],
  });
  const each = balance / BigInt(locks);
  if (each < 10n ** 18n) throw new Error(`Need at least ${locks} MEZO, wallet holds ${formatEther(balance)}`);
  await approveIfNeeded(signer, MEZO_MATSNET.mezoToken, dep.veMezo, each * BigInt(locks), "MEZO for veMEZO");

  for (let i = 0; i < locks; i++) {
    const create = encodeFunctionData({ abi: votingEscrowAbi, functionName: "createLock", args: [each, VEMEZO_LOCK] });
    const receipt = await sendTx(signer, `veMEZO lock ${i + 1}`, dep.veMezo, create);
    const tokenId = mintedTokenId(receipt, dep.veMezo, me(signer));
    await depositShard(signer, dep, tokenId);
  }
}

/// Sends a veMEZO NFT to the vault, which makes its lock permanent and mints jMEZO 1:1.
async function depositShard(signer: Signer, dep: JanusDeployment, tokenId: bigint): Promise<void> {
  const deposit = encodeFunctionData({
    abi: votingEscrowAbi,
    functionName: "safeTransferFrom",
    args: [me(signer), dep.vault, tokenId],
  });
  await sendTx(signer, `deposit veMEZO ${tokenId}`, dep.veMezo, deposit);
  const state = readState();
  writeState({ ...state, shards: [...state.shards, tokenId.toString()] });
}

/// Locks BTC into a permanent veBTC NFT and creates its BoostVoter gauge.
async function boostableNft(signer: Signer, dep: JanusDeployment, sats: bigint, label: string): Promise<SeededNft> {
  const amount = sats * SATOSHI;
  await approveIfNeeded(signer, MEZO_MATSNET.btcToken, dep.veBtc, amount, `BTC for veBTC ${label}`);
  const create = encodeFunctionData({ abi: votingEscrowAbi, functionName: "createLock", args: [amount, VEBTC_LOCK] });
  const receipt = await sendTx(signer, `veBTC lock ${label}`, dep.veBtc, create);
  const tokenId = mintedTokenId(receipt, dep.veBtc, me(signer));
  const permanent = encodeFunctionData({ abi: votingEscrowAbi, functionName: "lockPermanent", args: [tokenId] });
  await sendTx(signer, `veBTC ${tokenId} permanent`, dep.veBtc, permanent);
  const gaugeTx = encodeFunctionData({
    abi: boostVoterAbi,
    functionName: "createBoostGauge",
    args: [MEZO_MATSNET.boostGaugeFactory, tokenId, [], []],
  });
  await sendTx(signer, `gauge for veBTC ${tokenId}`, dep.boostVoter, gaugeTx);
  const gauge = await signer.publicClient.readContract({
    address: dep.boostVoter,
    abi: boostVoterAbi,
    functionName: "boostableTokenIdToGauge",
    args: [tokenId],
  });
  return { tokenId: tokenId.toString(), gauge };
}

async function house(signer: Signer, dep: JanusDeployment, sats: bigint): Promise<void> {
  let state = readState();
  if (!state.house) {
    state = { ...state, house: await boostableNft(signer, dep, sats, "house") };
    writeState(state);
  }
  const current = await signer.publicClient.readContract({ address: dep.market, abi: boostMarketAbi, functionName: "fallbackGauge" });
  if (state.house && current !== state.house.gauge) {
    const data = encodeFunctionData({ abi: boostMarketAbi, functionName: "setFallbackGauge", args: [state.house.gauge] });
    await sendTx(signer, "set house fallback gauge", dep.market, data);
  }
  log("house", { house: state.house });
}

async function buyer(signer: Signer, dep: JanusDeployment, label: string, sats: bigint, price: bigint): Promise<void> {
  const state = readState();
  if (state.buyers.some((b) => b.label === label)) throw new Error(`Buyer ${label} already seeded`);
  const nft = await boostableNft(signer, dep, sats, `buyer ${label}`);
  const need = await signer.publicClient.readContract({
    address: dep.market,
    abi: boostMarketAbi,
    functionName: "quoteVotes",
    args: [BigInt(nft.tokenId), TARGET_BOOST],
  });
  // Escrow two rounds' worth of the full 5x need.
  const escrow = ((need * price) / 10n ** 18n + 1n) * 2n;
  await approveIfNeeded(signer, dep.musd, dep.market, escrow, `MUSD for order ${label}`);
  const place = encodeFunctionData({
    abi: boostMarketAbi,
    functionName: "placeOrder",
    args: [BigInt(nft.tokenId), price, TARGET_BOOST, escrow],
  });
  const receipt = await sendTx(signer, `order ${label}`, dep.market, place);
  const placed = parseEventLogs({ abi: boostMarketAbi, eventName: "OrderPlaced", logs: receipt.logs })[0];
  if (!placed) throw new Error("OrderPlaced event missing");
  const next = { ...readState() };
  writeState({ ...next, buyers: [...next.buyers, { label, ...nft, orderId: placed.args.orderId.toString() }] });
  log("buyer", { label, tokenId: nft.tokenId, need: formatEther(need), escrowMusd: formatEther(escrow) });
}

async function status(signer: Signer, dep: JanusDeployment): Promise<void> {
  const read = signer.publicClient;
  const who = me(signer);
  const balanceOf = (token: Address) => read.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [who] });
  const [btc, mezo, musd, jmezo, claimable, vaultPower, round, orderIds] = await Promise.all([
    read.getBalance({ address: who }),
    balanceOf(MEZO_MATSNET.mezoToken),
    balanceOf(dep.musd),
    read.readContract({ address: dep.vault, abi: janusVaultAbi, functionName: "balanceOf", args: [who] }),
    read.readContract({ address: dep.vault, abi: janusVaultAbi, functionName: "claimable", args: [who] }),
    read.readContract({ address: dep.vault, abi: janusVaultAbi, functionName: "totalVotingPower" }),
    read.readContract({ address: dep.market, abi: boostMarketAbi, functionName: "currentRound" }),
    read.readContract({ address: dep.market, abi: boostMarketAbi, functionName: "activeOrderIds" }),
  ]);
  log("wallet", {
    address: who,
    btc: formatEther(btc),
    mezo: formatEther(mezo),
    musd: formatEther(musd),
    jmezo: formatEther(jmezo),
    claimableMusd: formatEther(claimable),
  });
  log("market", { vaultVotingPower: formatEther(vaultPower), roundId: round[0], phase: round[1].phase, orders: orderIds });
  log("seed", { ...readState() });
}

async function main(): Promise<void> {
  const [command = "status", ...args] = process.argv.slice(2);
  const signer = makeSigner();
  const dep = () => loadDeployment(MATSNET_CHAIN_ID);
  switch (command) {
    case "status":
      return status(signer, dep());
    case "quote":
      return quote(signer, args[0] ?? "0.001");
    case "swap":
      return swap(signer, args[0] ?? "0.002", "musd");
    case "swap-mezo":
      return swap(signer, args[0] ?? "0.001", "mezo");
    case "vemezo":
      return veMezoLocks(signer, dep(), Number(args[0] ?? 3));
    case "deposit": {
      const [tokenId] = args;
      if (!tokenId) throw new Error("usage: seed deposit <veMEZO tokenId>");
      return depositShard(signer, dep(), BigInt(tokenId));
    }
    case "house":
      return house(signer, dep(), BigInt(args[0] ?? 1_000));
    case "buyer": {
      const [label, sats, price] = args;
      if (!label || !sats || !price) throw new Error("usage: seed buyer <label> <sats> <price MUSD per vote>");
      return buyer(signer, dep(), label, BigInt(sats), parseEther(price));
    }
    default:
      throw new Error(`Unknown command ${command}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
