"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { Address, Hash, Hex, TransactionReceipt } from "viem";
import { usePublicClient, useSendTransaction, useSwitchChain } from "wagmi";
import { explainError } from "@/lib/errors";
import { MAX_TX_GAS, gasWithHeadroom, likelyOutOfGas } from "@/lib/protocol/keeper/gas";
import { mezoTestnet, useSendTransaction as usePassportSend, useWalletAccount } from "@/lib/wallet/passport";

export interface TxRequest {
  readonly to: Address;
  readonly data: Hex;
  readonly value?: bigint;
  /// Short present-tense label for toasts, such as "Placing bid".
  readonly label: string;
  /// Past-tense label for the success toast, such as "Bid placed".
  readonly done: string;
}

export type TxStatus = "idle" | "checking" | "signing" | "pending" | "success" | "error";

export interface TxState {
  readonly status: TxStatus;
  readonly hash?: Hash;
  readonly error?: string;
}

/// Sends one Janus transaction the same way for every wallet: simulate first so a revert
/// shows its reason before anything is signed, sign with the wallet (Bitcoin wallets act
/// through their Mezo smart account), wait for the receipt, then refresh every query.
/// EVM wallets get a padded gas limit and one retry at the cap when a transaction that
/// simulated cleanly runs out of gas, because matsnet's gas estimates can come in low.
export function useJanusTx() {
  const { accountAddress, networkFamily, chainId } = useWalletAccount();
  const client = usePublicClient({ chainId: mezoTestnet.id });
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransaction: sendThroughPassport } = usePassportSend();
  const queryClient = useQueryClient();
  const [state, setState] = useState<TxState>({ status: "idle" });
  const bitcoin = networkFamily === "bitcoin";

  const sign = useCallback(
    async ({ to, data, value = 0n }: TxRequest, gas: bigint | undefined): Promise<Hash | undefined> => {
      if (bitcoin) return (await sendThroughPassport(to, value, data))?.hash;
      if (chainId !== mezoTestnet.id) await switchChainAsync({ chainId: mezoTestnet.id });
      return sendTransactionAsync({ to, data, value, gas, chainId: mezoTestnet.id });
    },
    [bitcoin, chainId, sendThroughPassport, sendTransactionAsync, switchChainAsync],
  );

  const send = useCallback(
    async (request: TxRequest): Promise<TransactionReceipt | null> => {
      const fail = (error: unknown) => {
        const message = explainError(error);
        setState({ status: "error", error: message });
        toast.error(`${request.label} failed`, { description: message });
        return null;
      };
      if (!client || !accountAddress) return fail(new Error("Connect a wallet first."));
      const call = { account: accountAddress, to: request.to, data: request.data, value: request.value ?? 0n };

      let gas: bigint | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        setState({ status: "checking" });
        try {
          await client.call(call);
          if (!bitcoin && gas === undefined) gas = gasWithHeadroom(await client.estimateGas(call));
        } catch (error) {
          return fail(error);
        }

        setState({ status: "signing" });
        let hash: Hash | undefined;
        try {
          hash = await sign(request, gas);
        } catch (error) {
          return fail(error);
        }
        if (!hash) return fail(new Error("The wallet did not return a transaction."));

        setState({ status: "pending", hash });
        const pending = toast.loading(request.label, { description: "Waiting for Mezo to confirm." });
        let receipt: TransactionReceipt;
        try {
          receipt = await client.waitForTransactionReceipt({ hash });
        } catch (error) {
          toast.dismiss(pending);
          return fail(error);
        }
        toast.dismiss(pending);
        if (receipt.status === "success") {
          setState({ status: "success", hash });
          toast.success(request.done);
          await queryClient.invalidateQueries({ queryKey: ["janus"] });
          return receipt;
        }
        const retry = attempt === 0 && gas !== undefined && gas < MAX_TX_GAS && likelyOutOfGas(receipt.gasUsed, gas);
        if (!retry) return fail(new Error("The transaction reverted on chain."));
        toast.message("Retrying with more gas", { description: "Mezo's gas estimate came in low. Approve once more." });
        gas = MAX_TX_GAS;
      }
      return fail(new Error("The transaction ran out of gas twice."));
    },
    [accountAddress, bitcoin, client, queryClient, sign],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);
  const busy = state.status === "checking" || state.status === "signing" || state.status === "pending";
  /// False without a connected wallet, as in the read-only ?as= preview.
  const ready = Boolean(accountAddress);
  return { send, state, busy, ready, reset };
}
