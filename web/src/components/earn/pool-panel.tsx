"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Num } from "@/components/num";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useJanusAccount } from "@/hooks/use-janus-account";
import { useJanusTx } from "@/hooks/use-janus-tx";
import { usePool } from "@/hooks/use-pool";
import { calls } from "@/lib/chain/calls";
import { musdContract, vaultContract } from "@/lib/chain/contracts";
import type { PoolSnapshot } from "@/lib/chain/pool-snapshot";
import { explorerUrl } from "@/lib/explorer";
import { minReceived, priceOfJmezo, quoteSwap, type SwapSide } from "@/lib/protocol/pool";
import { parseDecimal } from "@/lib/protocol/units";
import { cn } from "@/lib/utils";

const SLIPPAGE_BPS = 100n;
const DEADLINE_SECONDS = 1_200n;
const SIDES: readonly { readonly side: SwapSide; readonly label: string }[] = [
  { side: "sell", label: "Sell jMEZO" },
  { side: "buy", label: "Buy jMEZO" },
];

function amountError(input: string, amount: bigint | null, balance: bigint | undefined, unit: string): string | undefined {
  if (input.trim() === "") return undefined;
  if (amount === null || amount === 0n) return `Enter an amount of ${unit}.`;
  if (balance !== undefined && amount > balance) return `That is more ${unit} than this account holds.`;
  return undefined;
}

function SwapForm({ pool }: { readonly pool: PoolSnapshot }) {
  const account = useJanusAccount();
  const approve = useJanusTx();
  const swap = useJanusTx();
  const [side, setSide] = useState<SwapSide>("sell");
  const [input, setInput] = useState("");

  const selling = side === "sell";
  const unit = selling ? "jMEZO" : "MUSD";
  const balance = selling ? account.data?.jmezo : account.data?.musd;
  const allowance = selling ? pool.jmezoAllowance : pool.musdAllowance;
  const [from, to] = selling ? [vaultContract.address, musdContract.address] : [musdContract.address, vaultContract.address];
  const parsed = parseDecimal(input);
  const error = amountError(input, parsed, balance, unit);
  const amount = parsed !== null && parsed > 0n && !error ? parsed : null;
  const out = amount === null ? null : quoteSwap(pool, side, amount);
  const needsApproval = amount !== null && allowance < amount;
  const busy = approve.busy || swap.busy;

  const submit = async () => {
    if (amount === null || out === null || !account.address) return;
    if (needsApproval) {
      await approve.send({ ...calls.approveRouter(from, amount), label: `Approving ${unit}`, done: `${unit} approved` });
      return;
    }
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECONDS;
    const receipt = await swap.send({
      ...calls.swap(from, to, amount, minReceived(out, SLIPPAGE_BPS), account.address, deadline),
      label: selling ? "Selling jMEZO" : "Buying jMEZO",
      done: selling ? "jMEZO sold" : "jMEZO bought",
    });
    if (receipt) setInput("");
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div role="group" aria-label="Swap direction" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {SIDES.map((item) => (
          <button
            key={item.side}
            type="button"
            aria-pressed={side === item.side}
            onClick={() => {
              setSide(item.side);
              setInput("");
            }}
            className={cn(
              "min-h-10 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              side === item.side ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Field
        label="You pay"
        unit={unit}
        inputMode="decimal"
        autoComplete="off"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        error={error}
        hint={balance !== undefined ? <>Balance: <Num value={balance} kind={selling ? "jmezo" : "musd"} /></> : undefined}
      />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">You receive about</dt>
        <dd className="text-right font-medium"><Num value={out} kind={selling ? "musd" : "jmezo"} /></dd>
        <dt className="text-muted-foreground">At least, with 1% slippage</dt>
        <dd className="text-right"><Num value={out === null ? null : minReceived(out, SLIPPAGE_BPS)} kind={selling ? "musd" : "jmezo"} /></dd>
      </dl>
      <Button type="submit" variant="patina" className="w-full" disabled={!swap.ready || amount === null || out === 0n || busy} loading={busy}>
        {needsApproval ? `Approve ${unit}` : selling ? "Sell jMEZO" : "Buy jMEZO"}
      </Button>
    </form>
  );
}

/// Makes the receipt liquid: jMEZO can be sold for MUSD without redeeming a whole shard.
export function PoolPanel() {
  const account = useJanusAccount();
  const pool = usePool(account.address);
  if (pool.isError) return <ErrorState title="Could not read the jMEZO pool" error={pool.error} onRetry={() => void pool.refetch()} />;
  if (pool.isPending) return <Skeleton className="h-64" />;
  if (!pool.data) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">Trade jMEZO</CardTitle>
          <p className="text-sm text-muted-foreground">Exit for MUSD without redeeming a whole shard. Sold jMEZO stops earning.</p>
        </div>
        <a
          href={explorerUrl("address", pool.data.address)}
          target="_blank"
          rel="noreferrer"
          aria-label="Open the pool on the Mezo explorer"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Price per jMEZO</dt>
            <dd className="text-xl font-semibold"><Num value={priceOfJmezo(pool.data)} kind="musd" /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pool holds</dt>
            <dd className="font-medium"><Num value={pool.data.jmezo} kind="jmezo" /> and <Num value={pool.data.musd} kind="musd" /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Swap fee</dt>
            <dd className="font-medium"><Num value={Number(pool.data.feeBps) / 100} kind="percent" /></dd>
          </div>
        </dl>
        <SwapForm pool={pool.data} />
      </CardContent>
    </Card>
  );
}
