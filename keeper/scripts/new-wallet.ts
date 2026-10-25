// Creates a throwaway testnet key in the repo-root .env (never printed) and prints its address.
// Usage: pnpm wallet:new [ROLE]   ROLE is DEPLOYER (default) or FAUCET, the starter-kit wallet.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const ROLES = ["DEPLOYER", "FAUCET"] as const;
const role = (process.argv[2] ?? "DEPLOYER").toUpperCase();
if (!ROLES.includes(role as (typeof ROLES)[number])) {
  throw new Error(`Unknown role ${role}. Use one of ${ROLES.join(", ")}.`);
}

const envPath = resolve(process.cwd(), "..", ".env");
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const match = existing.match(new RegExp(`^${role}_PRIVATE_KEY=(0x[0-9a-fA-F]{64})\\s*$`, "m"));
const label = role.toLowerCase();

if (match) {
  const account = privateKeyToAccount(match[1] as `0x${string}`);
  console.log(`${label}: ${account.address} (existing)`);
} else {
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key);
  const separator = existing && !existing.endsWith("\n") ? "\n" : "";
  const lines = `${role}_PRIVATE_KEY=${key}\n${role}_ADDRESS=${account.address}\n`;
  writeFileSync(envPath, `${existing}${separator}${lines}`, { mode: 0o600 });
  console.log(`${label}: ${account.address} (new, written to .env)`);
}
