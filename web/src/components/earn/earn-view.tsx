"use client";

import { ConnectCard, NotDeployed, WatchBanner } from "@/components/gates";
import { Num } from "@/components/num";
import { StarterKitCard } from "@/components/onboarding/starter-kit-card";
import { PageHeader } from "@/components/page-header";
import { Stat } from "@/components/stat";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { IS_DEPLOYED } from "@/config/deployment";
import { useJanusAccount } from "@/hooks/use-janus-account";
import { useMarket } from "@/hooks/use-market";
import { DepositList } from "./deposit-list";
import { PositionCard } from "./position-card";
import { ShardTable } from "./shard-table";

const BPS = 10_000n;

function VaultStats() {
  const market = useMarket();
  const data = market.data;
  const loading = market.isPending;
  if (market.isError) {
    return <ErrorState title="Could not read the vault" error={market.error} onRetry={() => void market.refetch()} />;
  }
  const holdersShare = data ? Number(BPS - data.feeBps) / 100 : null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Votes in the vault" loading={loading} value={<Num value={data?.vault.votingPower} kind="votes" />} hint={data ? `${data.vault.shards.length} of ${data.vault.maxShards.toString()} shard slots` : undefined} />
      <Stat label="jMEZO supply" loading={loading} value={<Num value={data?.vault.supply} kind="jmezo" />} hint="1 jMEZO per MEZO locked" />
      <Stat label="Paid to holders" loading={loading} value={<Num value={data?.vault.totalRewards} kind="musd" />} hint="All time" />
      <Stat label="Holders' share" loading={loading} value={<Num value={holdersShare} kind="percent" />} hint="Of every payment. The rest is the treasury fee." />
    </div>
  );
}

function YourSide() {
  const account = useJanusAccount();
  const market = useMarket();
  if (!account.address) return <ConnectCard title="Connect to deposit veMEZO and claim MUSD" />;
  if (account.isError) {
    return <ErrorState title="Could not read your account" error={account.error} onRetry={() => void account.refetch()} />;
  }
  if (!account.data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]" aria-busy="true" aria-label="Loading your position">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  const needsKit = !account.readOnly && account.data.veMezo.length === 0 && account.data.jmezo === 0n;
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      {account.readOnly ? (
        <div className="lg:col-span-2">
          <WatchBanner address={account.data.address} />
        </div>
      ) : null}
      <PositionCard account={account.data} supply={market.data?.vault.supply} />
      <section aria-labelledby="deposit-title" className="space-y-3">
        <h2 id="deposit-title" className="text-lg font-semibold">
          Your veMEZO NFTs
        </h2>
        <DepositList account={account.data} />
        {needsKit ? <StarterKitCard /> : null}
      </section>
    </div>
  );
}

export function EarnView() {
  const market = useMarket();
  const account = useJanusAccount();
  return (
    <div className="container space-y-10 pb-16">
      <PageHeader
        eyebrow="Patina face"
        tone="patina"
        title={
          <>
            Put my <em className="text-patina">veMEZO</em> to work
          </>
        }
        description="Deposit a veMEZO NFT into the Janus vault. Its votes are sold to veBTC holders every epoch, and jMEZO holders earn 90% of what they pay."
      />
      {!IS_DEPLOYED ? (
        <NotDeployed />
      ) : (
        <>
          <VaultStats />
          <YourSide />
          <section aria-labelledby="shards-title" className="space-y-3">
            <div className="space-y-1">
              <h2 id="shards-title" className="text-lg font-semibold">
                Vault shards
              </h2>
              <p className="text-sm text-muted-foreground">
                Any jMEZO holder can redeem any shard by burning jMEZO equal to the MEZO it locks.
              </p>
            </div>
            {market.data ? (
              <ShardTable shards={market.data.vault.shards} jmezo={account.data?.jmezo} />
            ) : (
              <Skeleton className="h-40" />
            )}
          </section>
        </>
      )}
    </div>
  );
}
