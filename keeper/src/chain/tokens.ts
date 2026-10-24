import {
  encodeFunctionData,
  getAddress,
  parseEventLogs,
  zeroAddress,
  type Address,
  type TransactionReceipt,
} from "viem";
import { erc20Abi, votingEscrowAbi } from "../abi/mezo.js";
import { sendTx, type Signer } from "./tx.js";

/// Approves `spender` for `amount` only when the current allowance falls short.
export async function approveIfNeeded(
  signer: Signer,
  token: Address,
  spender: Address,
  amount: bigint,
  label: string,
): Promise<void> {
  const owner = signer.walletClient.account.address;
  const allowance = await signer.publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
  if (allowance >= amount) return;
  const data = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });
  await sendTx(signer, `approve ${label}`, token, data);
}

/// The id of the NFT that `escrow` minted to `to` in this receipt.
export function mintedTokenId(receipt: TransactionReceipt, escrow: Address, to: Address): bigint {
  const transfers = parseEventLogs({ abi: votingEscrowAbi, eventName: "Transfer", logs: receipt.logs });
  const minted = transfers.find(
    (log) =>
      getAddress(log.address) === getAddress(escrow) &&
      log.args.from === zeroAddress &&
      getAddress(log.args.to) === getAddress(to),
  );
  if (!minted) throw new Error(`No mint from ${escrow} to ${to} in ${receipt.transactionHash}`);
  return minted.args.tokenId;
}
