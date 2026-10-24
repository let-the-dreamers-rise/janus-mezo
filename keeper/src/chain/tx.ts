import {
  BaseError,
  ContractFunctionRevertedError,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type Transport,
  type WalletClient,
} from "viem";

import { MAX_TX_GAS, gasWithHeadroom, likelyOutOfGas } from "../lib/gas.js";

export type Logger = (event: string, data?: Record<string, unknown>) => void;

export interface Signer {
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient<Transport, Chain, Account>;
  readonly log: Logger;
}

export function describeRevert(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      return reverted.data?.errorName ?? reverted.shortMessage;
    }
    return error.shortMessage;
  }
  return error instanceof Error ? error.message : String(error);
}

/// Simulates the call, so a revert surfaces with its reason instead of burning gas, and
/// returns the padded gas limit to send it with.
async function prepare(signer: Signer, label: string, to: Address, data: Hex): Promise<bigint> {
  const { publicClient, walletClient } = signer;
  const account = walletClient.account;
  try {
    await publicClient.call({ account, to, data });
    return gasWithHeadroom(await publicClient.estimateGas({ account, to, data }));
  } catch (error) {
    throw new Error(`${label} would revert: ${describeRevert(error)}`);
  }
}

async function submit(signer: Signer, to: Address, data: Hex, gas: bigint): Promise<TransactionReceipt> {
  const hash = await signer.walletClient.sendTransaction({ to, data, gas });
  return signer.publicClient.waitForTransactionReceipt({ hash });
}

/// Sends a transaction and waits for a successful receipt. One that passed simulation but
/// reverted after using nearly all of its gas is retried once with the full cap.
export async function sendTx(
  signer: Signer,
  label: string,
  to: Address,
  data: Hex,
): Promise<TransactionReceipt> {
  const gas = await prepare(signer, label, to, data);
  let receipt = await submit(signer, to, data, gas);
  if (receipt.status !== "success" && gas < MAX_TX_GAS && likelyOutOfGas(receipt.gasUsed, gas)) {
    signer.log("tx.outOfGas", { label, hash: receipt.transactionHash, gasUsed: receipt.gasUsed, gasLimit: gas });
    await prepare(signer, label, to, data);
    receipt = await submit(signer, to, data, MAX_TX_GAS);
  }
  if (receipt.status !== "success") throw new Error(`${label} reverted in ${receipt.transactionHash}`);
  signer.log("tx", { label, hash: receipt.transactionHash, gasUsed: receipt.gasUsed, block: receipt.blockNumber });
  return receipt;
}
