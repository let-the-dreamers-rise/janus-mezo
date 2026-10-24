"use client";

import { useCallback } from "react";
import type { Address, PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { calls, type Call } from "@/lib/chain/calls";
import type { MarketSnapshot } from "@/lib/chain/market-snapshot";
import { fitBatch } from "@/lib/protocol/keeper/batch";
import type { Step } from "@/lib/protocol/round-step";
import { mezoTestnet, useWalletAccount } from "@/lib/wallet/passport";
import { useJanusTx } from "./use-janus-tx";

/// The keeper's limits: at most 10 shards per batch, and a batch must estimate under 6M gas.
const MAX_BATCH = 10n;
const GAS_BUDGET = 6_000_000n;
const MAX_POKES = 16;

const DONE: Record<Step["kind"], string> = {
  startRound: "Round started",
  resetShards: "Shards reset",
  settle: "Round settled",
  castVotes: "Votes cast",
  finalize: "Round finalized",
  applyBoosts: "Boosts applied",
  wait: "",
};

async function batchSize(client: PublicClient | undefined, account: Address | undefined, kind: "resetShards" | "castVotes") {
  if (!client || !account) return 1n;
  const fit = await fitBatch(MAX_BATCH, GAS_BUDGET, async (size) => {
    try {
      return await client.estimateGas({ account, ...calls.roundBatch(kind, size) });
    } catch {
      return null;
    }
  });
  return fit?.size ?? 1n;
}

/// Sends the call that moves the market forward, exactly as the keeper would.
export function useRunStep() {
  const tx = useJanusTx();
  const client = usePublicClient({ chainId: mezoTestnet.id });
  const { accountAddress } = useWalletAccount();

  const run = useCallback(
    async (step: Step, snapshot: MarketSnapshot) => {
      let call: Call | undefined;
      switch (step.kind) {
        case "startRound":
        case "settle":
        case "finalize":
          call = calls.roundStep(step.kind);
          break;
        case "resetShards":
        case "castVotes":
          call = calls.roundBatch(step.kind, await batchSize(client, accountAddress, step.kind));
          break;
        case "applyBoosts":
          call = calls.pokeBoosts(snapshot.staleBoostIds.slice(0, MAX_POKES));
          break;
        case "wait":
          return null;
      }
      return tx.send({ ...call, label: step.label, done: DONE[step.kind] });
    },
    [accountAddress, client, tx],
  );

  return { run, busy: tx.busy };
}
