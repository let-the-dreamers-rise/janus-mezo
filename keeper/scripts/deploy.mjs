// Runs contracts/script/Deploy.s.sol with the deployer key from the repo .env, which is
// read here and passed only through the child's environment. Nothing prints it.
// Usage: node scripts/deploy.mjs matsnet
//        node scripts/deploy.mjs mezo --confirm-mainnet
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contracts = resolve(here, "../../contracts");
const CHAIN_IDS = { matsnet: 31611, mezo: 31612 };
const PASSED = ["DEPLOYER_PRIVATE_KEY", "JANUS_TREASURY", "JANUS_DEPOSIT_CAP"];

const [network, ...flags] = process.argv.slice(2);
const chainId = CHAIN_IDS[network];
if (!chainId) throw new Error("usage: node scripts/deploy.mjs <matsnet|mezo> [--confirm-mainnet]");
if (network === "mezo" && !flags.includes("--confirm-mainnet")) throw new Error("mainnet needs --confirm-mainnet");

const dotenv = readFileSync(resolve(here, "../../.env"), "utf8");
const env = { ...process.env };
for (const name of PASSED) {
  const match = dotenv.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (match) env[name] = match[1].trim().replace(/^["']|["']$/g, "");
}
if (!env.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY is not set in the repo .env");

const record = resolve(contracts, `deployments/${chainId}.json`);
if (existsSync(record)) copyFileSync(record, resolve(contracts, `deployments/${chainId}.previous.json`));

const forge = resolve(process.env.USERPROFILE ?? process.env.HOME ?? "", ".foundry/bin/forge");
const { status } = spawnSync(
  forge,
  ["script", "script/Deploy.s.sol", "--rpc-url", network, "--broadcast", "--slow", "--legacy", "--gas-estimate-multiplier", "140"],
  { cwd: contracts, env, stdio: "inherit" },
);
process.exit(status ?? 1);
