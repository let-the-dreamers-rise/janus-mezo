import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress, type Address } from "viem";

/// Addresses written by contracts/script/Deploy.s.sol to contracts/deployments/<chainId>.json.
export interface JanusDeployment {
  readonly chainId: number;
  readonly deployedAtBlock: bigint;
  readonly vault: Address;
  readonly market: Address;
  readonly owner: Address;
  readonly treasury: Address;
  readonly boostVoter: Address;
  readonly veMezo: Address;
  readonly veBtc: Address;
  readonly musd: Address;
}

const ADDRESS_KEYS = [
  "vault",
  "market",
  "owner",
  "treasury",
  "boostVoter",
  "veMezo",
  "veBtc",
  "musd",
] as const;

type AddressKey = (typeof ADDRESS_KEYS)[number];

export const deploymentPath = (chainId: number): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../contracts/deployments", `${chainId}.json`);

/// Validates an untrusted deployment record and normalises its addresses to checksum form.
export function parseDeployment(raw: unknown, chainId: number): JanusDeployment {
  if (typeof raw !== "object" || raw === null) throw new Error("deployment is not a JSON object");
  const record = raw as Record<string, unknown>;
  if (Number(record.chainId) !== chainId) {
    throw new Error(`deployment is for chain ${String(record.chainId)}, expected ${chainId}`);
  }
  const addresses = {} as Record<AddressKey, Address>;
  for (const key of ADDRESS_KEYS) {
    const value = record[key];
    if (typeof value !== "string" || !isAddress(value)) {
      throw new Error(`deployment.${key} is not an address`);
    }
    addresses[key] = getAddress(value);
  }
  const block = record.deployedAtBlock;
  if (typeof block !== "number" && typeof block !== "string") {
    throw new Error("deployment.deployedAtBlock is missing");
  }
  return { chainId, deployedAtBlock: BigInt(block), ...addresses };
}

export function loadDeployment(chainId: number): JanusDeployment {
  const path = deploymentPath(chainId);
  if (!existsSync(path)) throw new Error(`No deployment at ${path}. Run the forge deploy script first.`);
  return parseDeployment(JSON.parse(readFileSync(path, "utf8")), chainId);
}
