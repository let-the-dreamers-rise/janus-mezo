"use client";

import Link from "next/link";
import { Num } from "@/components/num";
import { Stat } from "@/components/stat";
import { ErrorState } from "@/components/states";
import { IS_DEPLOYED } from "@/config/deployment";
import { useMarketNow } from "@/hooks/use-market-clock";
import { nextStep } from "@/lib/protocol/round-step";
import { nextRoundLabel, voteWindow } from "@/lib/protocol/vote-window";

export function MarketPulse() {
  const { market, now } = useMarketNow();
  const data = market.data;
  const loading = IS_DEPLOYED && market.isPending;
  const clock = now ?? data?.now;
  const step = data && clock !== undefined ? nextStep(data.round, clock, data.signals, data.staleBoostIds.length) : undefined;

  return (
    <section aria-labelledby="pulse-title" className="container space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="pulse-title" className="text-sm font-medium text-muted-foreground">
          The market right now
        </h2>
        <Link href="/market/" className="rounded-sm text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Open the market
        </Link>
      </div>
      {market.isError ? (
        <ErrorState title="Could not read the market" error={market.error} onRetry={() => void market.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Votes in the vault"
            loading={loading}
            value={<Num value={data?.vault.votingPower} kind="votes" />}
            hint={data ? `${data.vault.shards.length} veMEZO shards` : "veMEZO voting power"}
          />
          <Stat
            label="Open bids"
            loading={loading}
            value={<span className="num">{data ? data.orders.length : "--"}</span>}
            hint="Up to 32 veBTC NFTs at a time"
          />
          <Stat
            label="Paid to jMEZO holders"
            loading={loading}
            value={<Num value={data?.vault.totalRewards} kind="musd" />}
            hint="All time, after the 10% fee"
          />
          <Stat
            label="Next step"
            loading={loading}
            value={step?.label ?? "--"}
            hint={clock === undefined ? undefined : step?.code === "sold-out" ? nextRoundLabel(clock) : voteWindow(clock).label}
          />
        </div>
      )}
    </section>
  );
}
