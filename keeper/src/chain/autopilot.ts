import { encodeFunctionData, parseAbi, type Address } from "viem";
import { pickRelockable } from "../lib/autopilot.js";
import { sendTx, type Signer } from "./tx.js";

export const autopilotAbi = parseAbi([
  "function canRelock(uint256 tokenId) view returns (bool)",
  "function relock(uint256[] tokenIds) returns (uint256)",
]);

/// Relocks every opted-in veBTC among the candidates whose lock can be extended now.
/// Returns how many tokens were sent to relock.
export async function runAutopilot(
  signer: Signer,
  autopilot: Address,
  candidates: readonly bigint[],
): Promise<number> {
  if (candidates.length === 0) return 0;
  const reads = await signer.publicClient.multicall({
    contracts: candidates.map((id) => ({
      address: autopilot,
      abi: autopilotAbi,
      functionName: "canRelock" as const,
      args: [id] as const,
    })),
  });
  const due = pickRelockable(candidates, reads);
  if (due.length === 0) return 0;
  const data = encodeFunctionData({ abi: autopilotAbi, functionName: "relock", args: [due] });
  await sendTx(signer, `relock(${due.length})`, autopilot, data);
  return due.length;
}
