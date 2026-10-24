"use client";

import { Bitcoin } from "lucide-react";
import { ConnectCard, NotDeployed, WatchBanner } from "@/components/gates";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/states";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IS_DEPLOYED } from "@/config/deployment";
import { SITE } from "@/config/site";
import { useJanusAccount } from "@/hooks/use-janus-account";
import { useMarket } from "@/hooks/use-market";
import type { MarketSnapshot } from "@/lib/chain/market-snapshot";
import { QuoteCalculator } from "./quote-calculator";
import { VeBtcCard } from "./vebtc-card";

function YourVeBtc({ snapshot }: { readonly snapshot: MarketSnapshot | undefined }) {
  const account = useJanusAccount();
  if (!account.address) {
    return <ConnectCard title="Connect to see your veBTC NFTs" />;
  }
  if (account.isError) {
    return <ErrorState title="Could not read your account" error={account.error} onRetry={() => void account.refetch()} />;
  }
  if (!account.data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading your veBTC NFTs">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (account.data.veBtc.length === 0) {
    return (
      <EmptyState
        icon={Bitcoin}
        title="No veBTC NFTs in this account"
        action={
          <ButtonLink href={SITE.mezoDocsUrl} variant="outline" target="_blank" rel="noreferrer">
            How veBTC works
          </ButtonLink>
        }
      >
        Lock BTC in Mezo Earn to get a veBTC NFT, then come back to bid for its boost.
      </EmptyState>
    );
  }
  const nfts = account.data;
  return (
    <div className="space-y-4">
      {account.readOnly ? <WatchBanner address={nfts.address} /> : null}
      {nfts.veBtc.map((nft) => (
        <VeBtcCard key={nft.id.toString()} nft={nft} snapshot={snapshot} account={nfts} />
      ))}
    </div>
  );
}

export function BoostView() {
  const market = useMarket();
  return (
    <div className="container space-y-10 pb-16">
      <PageHeader
        eyebrow="Bronze face"
        tone="bronze"
        title={
          <>
            Boost my <em className="text-primary">veBTC</em>
          </>
        }
        description="Bid MUSD for the veMEZO votes that lift a veBTC NFT's Mezo Earn boost, up to 5x. You pay only for votes that land on your gauge."
      />
      {!IS_DEPLOYED ? (
        <NotDeployed />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="nfts-title" className="space-y-4">
            <h2 id="nfts-title" className="text-lg font-semibold">
              Your veBTC NFTs
            </h2>
            {market.isError ? (
              <ErrorState title="Could not read the market" error={market.error} onRetry={() => void market.refetch()} />
            ) : null}
            <YourVeBtc snapshot={market.data} />
          </section>
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <QuoteCalculator snapshot={market.data} />
          </aside>
        </div>
      )}
    </div>
  );
}
