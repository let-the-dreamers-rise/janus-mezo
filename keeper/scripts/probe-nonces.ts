/// Checks whether matsnet takes back-to-back transactions from one sender with consecutive
/// nonces, without waiting for each receipt. Sends three 1-wei self-transfers from the
/// faucet wallet and times them. Usage: pnpm exec tsx scripts/probe-nonces.ts
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mezoMatsnet } from "../src/config/chain.js";
import { loadSignerKey } from "../src/config/env.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

async function main(): Promise<void> {
  const account = privateKeyToAccount(loadSignerKey(["FAUCET_PRIVATE_KEY"]));
  const transport = http();
  const publicClient = createPublicClient({ chain: mezoMatsnet, transport, pollingInterval: 1_000 });
  const walletClient = createWalletClient({ account, chain: mezoMatsnet, transport });
  const started = Date.now();
  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
  const hashes = [];
  for (let i = 0; i < 3; i++) {
    hashes.push(
      await walletClient.sendTransaction({ to: account.address, value: 1n, gas: 60_000n, nonce: nonce + i }).catch((e: Error) => `ERR ${e.message.split("\n")[0]}`),
    );
  }
  const submitted = Date.now() - started;
  const receipts = await Promise.all(
    hashes.map((hash) =>
      hash.startsWith("ERR")
        ? Promise.resolve(hash)
        : publicClient
            .waitForTransactionReceipt({ hash: hash as `0x${string}`, timeout: 60_000 })
            .then((r) => `${r.status} in block ${r.blockNumber}`, (e: Error) => `ERR ${e.message.split("\n")[0]}`),
    ),
  );
  console.log({ nonce, submittedMs: submitted, totalMs: Date.now() - started, receipts });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
