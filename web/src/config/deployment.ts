import { getAddress, isAddress, zeroAddress, type Address } from "viem";
import mainnetRecord from "./deployment.mainnet.json";
import matsnetRecord from "./deployment.json";
import { IS_MAINNET } from "./network";

/// The deployment for this build's network, copied from contracts/deployments/ by `pnpm sync`
/// in keeper/. Before the first deploy every Janus address is zero and the app says so.
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
  /// VeBtcAutopilot, which keeps opted-in veBTC locks at the maximum term.
  readonly autopilot?: Address;
}

const ADDRESS_FIELDS = ["vault", "market", "owner", "treasury", "boostVoter", "veMezo", "veBtc", "musd"] as const;

export function parseDeployment(value: unknown): JanusDeployment {
  if (typeof value !== "object" || value === null) throw new Error("deployment record must be a JSON object");
  const raw = value as Record<string, unknown>;
  const addresses = Object.fromEntries(
    ADDRESS_FIELDS.map((field) => {
      const entry = raw[field];
      if (typeof entry !== "string" || !isAddress(entry, { strict: false })) {
        throw new Error(`deployment.${field} is not an address`);
      }
      return [field, getAddress(entry)];
    }),
  ) as Record<(typeof ADDRESS_FIELDS)[number], Address>;
  const { chainId, deployedAtBlock } = raw;
  if (typeof chainId !== "number") throw new Error("deployment.chainId must be a number");
  if (typeof deployedAtBlock !== "number" || deployedAtBlock < 0) {
    throw new Error("deployment.deployedAtBlock must be a block number");
  }
  const { autopilot } = raw;
  if (autopilot !== undefined && (typeof autopilot !== "string" || !isAddress(autopilot, { strict: false }))) {
    throw new Error("deployment.autopilot is not an address");
  }
  return {
    chainId,
    deployedAtBlock: BigInt(deployedAtBlock),
    ...addresses,
    ...(autopilot === undefined ? {} : { autopilot: getAddress(autopilot) }),
  };
}

export const DEPLOYMENT = parseDeployment(IS_MAINNET ? mainnetRecord : matsnetRecord);
export const IS_DEPLOYED = DEPLOYMENT.vault !== zeroAddress && DEPLOYMENT.market !== zeroAddress;
