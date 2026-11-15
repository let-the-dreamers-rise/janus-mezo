"use client";

import type { ReactNode } from "react";
import { Num } from "@/components/num";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoundHistory } from "@/hooks/use-round-history";
import { roundAnalytics } from "@/lib/chain/round-analytics";

function Metric({ label, value, hint }: { readonly label: string; readonly value: ReactNode; readonly hint: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-medium">{value}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

/// Fill rate, price per vote and holder income across every closed round, from the chain.
export function RoundAnalytics() {
  const history = useRoundHistory();
  if (history.isError) return null;
  if (!history.data) return <Skeleton className="h-28" aria-label="Loading round analytics" />;
  const a = roundAnalytics(history.data);
  if (a.rounds === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Analytics appear after the first round closes.</p>;
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Fill rate" value={<Num value={a.fillRatePct} kind="percent" />} hint={`Of votes offered, across ${a.rounds} closed rounds`} />
      <Metric label="Avg price per vote" value={<Num value={a.avgPricePerVote} kind="musd" />} hint="What buyers paid per vote sold" />
      <Metric label="Paid to holders" value={<Num value={a.toHolders} kind="musd" />} hint="Total MUSD streamed to jMEZO holders" />
      <Metric label="Holder income" value={<Num value={a.holderIncomePer100Votes} kind="musd" />} hint="MUSD per 100 veMEZO offered, per round" />
    </dl>
  );
}
