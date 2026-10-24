"use client";

import { NotDeployed } from "@/components/gates";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { IS_DEPLOYED } from "@/config/deployment";
import { useMarketNow } from "@/hooks/use-market-clock";
import { useWalletAccount } from "@/lib/wallet/passport";
import { LastRound } from "./last-round";
import { OrderBook } from "./order-book";
import { RoundPanel } from "./round-panel";

function Content() {
  const { market, now } = useMarketNow();
  const { accountAddress } = useWalletAccount();
  if (market.isError) {
    return <ErrorState title="Could not read the market" error={market.error} onRetry={() => void market.refetch()} />;
  }
  const data = market.data;
  if (!data) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading the market">
        <Skeleton className="h-72" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  return (
    <div className="space-y-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <RoundPanel snapshot={data} now={now ?? data.now} />
        <section aria-labelledby="last-title" className="space-y-3">
          <h2 id="last-title" className="text-lg font-semibold">
            Latest round
          </h2>
          <LastRound snapshot={data} />
        </section>
      </div>
      <section aria-labelledby="book-title" className="space-y-3">
        <h2 id="book-title" className="text-lg font-semibold">
          Order book
        </h2>
        <OrderBook snapshot={data} account={accountAddress} />
      </section>
    </div>
  );
}

export function MarketView() {
  return (
    <div className="container space-y-10 pb-16">
      <PageHeader
        eyebrow="Rounds"
        title="The market"
        description="Every step of a round is a permissionless call. The Janus keeper runs them inside Mezo's vote window, and so can you, right here."
      />
      {IS_DEPLOYED ? <Content /> : <NotDeployed />}
    </div>
  );
}
