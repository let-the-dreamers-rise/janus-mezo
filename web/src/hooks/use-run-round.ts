"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { usePublicClient } from "wagmi";
import { readMarketSnapshot } from "@/lib/chain/market-snapshot";
import { nextStep } from "@/lib/protocol/round-step";
import { runRound } from "@/lib/protocol/run-round";
import { mezoTestnet } from "@/lib/wallet/passport";
import { MARKET_QUERY_KEY } from "./use-market";
import { useRunStep } from "./use-run-step";

interface RoundProgress {
  readonly running: boolean;
  /// The step being sent, numbered from 1.
  readonly current?: { readonly index: number; readonly label: string };
}

/// Runs every remaining step of the round, plus the boost pokes after it, re-reading the
/// market between calls. Each call is still signed on its own.
export function useRunRound() {
  const runner = useRunStep();
  const client = usePublicClient({ chainId: mezoTestnet.id });
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<RoundProgress>({ running: false });

  const runAll = useCallback(async () => {
    if (!client) return;
    setProgress({ running: true });
    try {
      const result = await runRound({
        read: () => queryClient.fetchQuery({ queryKey: MARKET_QUERY_KEY, queryFn: () => readMarketSnapshot(client), staleTime: 0 }),
        plan: (snapshot) => nextStep(snapshot.round, snapshot.now, snapshot.signals, snapshot.staleBoostIds.length),
        run: async (step, snapshot) => (await runner.run(step, snapshot)) !== null,
        onStep: (step, index) => setProgress({ running: true, current: { index: index + 1, label: step.label } }),
      });
      if (result.stopped === "done" && result.ran > 0) {
        toast.success("The market is up to date", { description: `${result.ran} calls sent. ${result.last.label}.` });
      } else if (result.stopped === "limit") {
        toast.message("Paused after many calls", { description: "Run it again to keep going." });
      }
    } catch (error) {
      toast.error("Could not read the market", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setProgress({ running: false });
    }
  }, [client, queryClient, runner]);

  return { runAll, progress };
}
