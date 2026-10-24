"use client";

import { Check, Play } from "lucide-react";
import { Num } from "@/components/num";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useRunStep } from "@/hooks/use-run-step";
import type { MarketSnapshot } from "@/lib/chain/market-snapshot";
import { PHASE, PHASE_NAMES, nextStep, phaseName } from "@/lib/protocol/round-step";
import { nextRoundLabel, voteWindow } from "@/lib/protocol/vote-window";
import { formatUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useWalletAccount } from "@/lib/wallet/passport";

const STEPS = PHASE_NAMES.slice(1);

/// `finished` marks every phase done, for a round that has closed.
function PhaseStepper({ phase, finished }: { readonly phase: number; readonly finished: boolean }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Round phases">
      {STEPS.map((name, index) => {
        const value = index + 1;
        const done = finished || (phase !== PHASE.Idle && value < phase);
        const current = value === phase;
        return (
          <li key={name} aria-current={current ? "step" : undefined} className="space-y-2">
            <span
              className={cn(
                "block h-1.5 rounded-full",
                current ? "bg-primary" : done ? "bg-primary/50" : "bg-muted",
              )}
            />
            <span className={cn("flex items-center gap-1 text-xs", current ? "font-medium text-foreground" : "text-muted-foreground")}>
              {done ? <Check className="size-3" aria-hidden /> : null}
              {name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function RoundPanel({ snapshot, now }: { readonly snapshot: MarketSnapshot; readonly now: bigint }) {
  const { round } = snapshot;
  const step = nextStep(round, now, snapshot.signals, snapshot.staleBoostIds.length);
  const window = voteWindow(now);
  const { isConnected } = useWalletAccount();
  const runner = useRunStep();
  const open = round.phase !== PHASE.Idle;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">{round.id === 0n ? "No round yet" : `Round ${round.id.toString()}`}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {open
              ? `${phaseName(round.phase)}, started ${formatUtc(round.startedAt)}`
              : round.id === 0n
                ? "The keeper starts the first round once a bid needs votes."
                : "Closed. Delivered votes were charged and paid out."}
          </p>
        </div>
        <span className={cn("num rounded-full border px-3 py-1 text-xs", window.open ? "border-patina/40 text-patina" : "text-muted-foreground")}>
          {window.label}
        </span>
      </CardHeader>
      <CardContent className="space-y-6">
        <PhaseStepper phase={round.phase} finished={!open && round.id > 0n} />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Epoch</dt>
            <dd className="font-medium">{round.epoch > 0n ? formatUtc(round.epoch) : "--"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Shards in round</dt>
            <dd className="num font-medium">{snapshot.roundShardCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Votes for sale</dt>
            <dd className="font-medium"><Num value={round.supply} kind="votes" /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Votes sold</dt>
            <dd className="font-medium"><Num value={round.filled} kind="votes" /></dd>
          </div>
        </dl>
        <div className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Next step</p>
            <p className="font-medium">{step.label}</p>
            <p className="text-sm text-muted-foreground">
              {step.detail}
              {step.code === "sold-out" ? ` ${nextRoundLabel(now)}.` : null}
            </p>
          </div>
          {step.kind === "wait" ? null : isConnected ? (
            <Button loading={runner.busy} onClick={() => void runner.run(step, snapshot)} className="shrink-0">
              <Play aria-hidden /> Run this step
            </Button>
          ) : (
            <WalletButton label="Connect to run it" className="shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Anyone can run these calls. The contract checks every rule, so a step that is not due simply reverts before you
          sign.
        </p>
      </CardContent>
    </Card>
  );
}
