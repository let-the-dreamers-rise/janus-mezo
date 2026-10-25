/// Read-only probe: veBTC and veMEZO supply, total voting power and the lock durations each
/// escrow accepts, found by simulating createLock from an address with no allowance. A
/// duration the escrow accepts gets as far as the token transfer and fails there instead.
/// Usage: pnpm exec tsx scripts/probe-locks.ts [from-address]   (defaults to DEPLOYER_ADDRESS)
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  formatEther,
  http,
  isAddress,
  parseAbi,
  type Address,
} from "viem";
import { votingEscrowAbi } from "../src/abi/mezo.js";
import { MEZO_MATSNET } from "../src/config/addresses.js";
import { mezoMatsnet } from "../src/config/chain.js";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const DAY = 86_400n;
const escrowErrors = parseAbi([
  "error LockDurationTooLong()",
  "error LockDurationNotInFuture()",
  "error ZeroAmount()",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
]);
const abi = [...votingEscrowAbi, ...escrowErrors] as const;
const client = createPublicClient({ chain: mezoMatsnet, transport: http() });

function reason(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      return reverted.data?.errorName ?? reverted.signature ?? reverted.shortMessage;
    }
    return error.shortMessage;
  }
  return String(error);
}

async function tryLock(escrow: Address, from: Address, value: bigint, days: bigint): Promise<string> {
  try {
    await client.simulateContract({
      address: escrow,
      abi,
      functionName: "createLock",
      args: [value, days * DAY],
      account: from,
    });
    return "ok";
  } catch (error) {
    return reason(error);
  }
}

async function probe(name: string, escrow: Address, from: Address, value: bigint, days: readonly bigint[]) {
  const read = <T>(functionName: "supply" | "totalVotingPower" | "unboostedTotalVotingPower") =>
    client.readContract({ address: escrow, abi, functionName }).catch(() => undefined) as Promise<T | undefined>;
  const [supply, power, unboosted] = await Promise.all([
    read<bigint>("supply"),
    read<bigint>("totalVotingPower"),
    read<bigint>("unboostedTotalVotingPower"),
  ]);
  const durations: Record<string, string> = {};
  for (const d of days) durations[`${d}d`] = await tryLock(escrow, from, value, d);
  console.log({
    escrow: name,
    supply: supply === undefined ? "n/a" : formatEther(supply),
    totalVotingPower: power === undefined ? "n/a" : formatEther(power),
    unboostedTotalVotingPower: unboosted === undefined ? "n/a" : formatEther(unboosted),
    durations,
  });
}

async function main(): Promise<void> {
  const candidate = process.argv[2] ?? process.env.DEPLOYER_ADDRESS;
  if (!candidate || !isAddress(candidate)) throw new Error("Pass an address or set DEPLOYER_ADDRESS in the repo .env");
  await probe("veBTC", MEZO_MATSNET.veBtc, candidate, 10n ** 10n, [7n, 14n, 21n, 28n, 29n, 35n, 56n, 365n]);
  await probe("veMEZO", MEZO_MATSNET.veMezo, candidate, 10n ** 18n, [7n, 365n, 1456n, 1463n, 1470n]);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
