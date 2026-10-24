// Creates a throwaway testnet deployer key in the repo-root .env (never printed).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const envPath = resolve(process.cwd(), "..", ".env");
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const match = existing.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})\s*$/m);

if (match) {
  const account = privateKeyToAccount(match[1] as `0x${string}`);
  console.log(`deployer: ${account.address} (existing)`);
} else {
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key);
  const separator = existing && !existing.endsWith("\n") ? "\n" : "";
  const lines = `DEPLOYER_PRIVATE_KEY=${key}\nDEPLOYER_ADDRESS=${account.address}\n`;
  writeFileSync(envPath, `${existing}${separator}${lines}`, { mode: 0o600 });
  console.log(`deployer: ${account.address} (new, written to .env)`);
}
