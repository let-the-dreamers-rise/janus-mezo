/// Sets up the starter-kit wallet that the web app's /api/starter-kit route signs with. Its
/// key sits in the repo .env as FAUCET_PRIVATE_KEY and in the Vercel project's environment,
/// and it only ever holds kit stock: BTC for gas and veBTC locks, MUSD, and faucet MEZO.
/// Usage: pnpm faucet <command>
///   status        balances and the allowances kit locks draw on
///   fund [btc]    send BTC from the deployer to the faucet wallet (default 0.01)
///   swap [btc] [musd|mezo]  swap the faucet wallet's BTC on the Mezo DEX (default 0.003 for MUSD)
///   quote [btc] [musd|mezo] what that swap would return, without sending anything
///   approve       let veBTC and veMEZO pull the faucet wallet's BTC and MEZO for kit locks
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, formatEther, http, maxUint256, parseEther, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "../src/abi/mezo.js";
import { ROUTES, quoteRoute, swapBtc } from "../src/chain/dex.js";
import { approveIfNeeded } from "../src/chain/tokens.js";
import type { Signer } from "../src/chain/tx.js";
import { MEZO_MATSNET } from "../src/config/addresses.js";
import { mezoMatsnet } from "../src/config/chain.js";
import { loadSignerKey } from "../src/config/env.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

/// Plenty for a native transfer; matsnet bills at least half the limit, which is still tiny.
const TRANSFER_GAS = 60_000n;

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, ...data }, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)));

function makeSigner(envName: string): Signer {
  const account = privateKeyToAccount(loadSignerKey([envName]));
  return {
    publicClient: createPublicClient({ chain: mezoMatsnet, transport: http() }),
    walletClient: createWalletClient({ account, chain: mezoMatsnet, transport: http() }),
    log,
  };
}

const addressOf = (signer: Signer): Address => signer.walletClient.account.address;
const readable = (amount: bigint) => (amount >= maxUint256 / 2n ? "unlimited" : formatEther(amount));

async function status(faucet: Signer): Promise<void> {
  const who = addressOf(faucet);
  const read = faucet.publicClient;
  const erc20 = (token: Address, functionName: "balanceOf" | "allowance", spender?: Address) =>
    functionName === "balanceOf"
      ? read.readContract({ address: token, abi: erc20Abi, functionName, args: [who] })
      : read.readContract({ address: token, abi: erc20Abi, functionName, args: [who, spender ?? who] });
  const [btc, mezo, musd, veBtcAllowance, veMezoAllowance] = await Promise.all([
    read.getBalance({ address: who }),
    erc20(MEZO_MATSNET.mezoToken, "balanceOf"),
    erc20(MEZO_MATSNET.musd, "balanceOf"),
    erc20(MEZO_MATSNET.btcToken, "allowance", MEZO_MATSNET.veBtc),
    erc20(MEZO_MATSNET.mezoToken, "allowance", MEZO_MATSNET.veMezo),
  ]);
  log("faucet", {
    address: who,
    btc: formatEther(btc),
    mezo: formatEther(mezo),
    musd: formatEther(musd),
    veBtcMayPull: readable(veBtcAllowance),
    veMezoMayPull: readable(veMezoAllowance),
  });
}

async function fund(deployer: Signer, to: Address, btc: string): Promise<void> {
  const hash = await deployer.walletClient.sendTransaction({ to, value: parseEther(btc), gas: TRANSFER_GAS });
  const receipt = await deployer.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Funding reverted in ${hash}`);
  log("fund", { to, btc, hash });
}

async function approve(faucet: Signer): Promise<void> {
  await approveIfNeeded(faucet, MEZO_MATSNET.btcToken, MEZO_MATSNET.veBtc, maxUint256, "BTC for veBTC kit locks");
  await approveIfNeeded(faucet, MEZO_MATSNET.mezoToken, MEZO_MATSNET.veMezo, maxUint256, "MEZO for veMEZO kit locks");
  log("approve.done");
}

async function main(): Promise<void> {
  const [command = "status", arg, token = "musd"] = process.argv.slice(2);
  const faucet = makeSigner("FAUCET_PRIVATE_KEY");
  if (token !== "musd" && token !== "mezo") throw new Error(`Unknown token ${token}; use musd or mezo`);
  const btcIn = parseEther(arg ?? "0.003");
  switch (command) {
    case "status":
      return status(faucet);
    case "fund":
      await fund(makeSigner("DEPLOYER_PRIVATE_KEY"), addressOf(faucet), arg ?? "0.01");
      return status(faucet);
    case "quote": {
      const quoted = await quoteRoute(faucet.publicClient, btcIn, ROUTES[token]);
      log("quote", { btc: formatEther(btcIn), token, out: quoted === null ? null : formatEther(quoted) });
      return;
    }
    case "swap": {
      const quoted = await swapBtc(faucet, btcIn, ROUTES[token], `swap ${formatEther(btcIn)} BTC for ${token}`);
      log("swap.done", { token, quoted: formatEther(quoted) });
      return status(faucet);
    }
    case "approve":
      await approve(faucet);
      return status(faucet);
    default:
      throw new Error(`Unknown command ${command}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
