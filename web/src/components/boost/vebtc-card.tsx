"use client";

import { ExternalLink, Zap } from "lucide-react";
import { Num } from "@/components/num";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJanusTx } from "@/hooks/use-janus-tx";
import type { AccountSnapshot, VeBtcNft } from "@/lib/chain/account-snapshot";
import { calls } from "@/lib/chain/calls";
import { veBtcContract } from "@/lib/chain/contracts";
import type { MarketSnapshot } from "@/lib/chain/market-snapshot";
import { nftUrl } from "@/lib/explorer";
import { staleBoosts } from "@/lib/protocol/keeper/boosts";
import { formatUtc } from "@/lib/time";
import { OrderForm } from "./order-form";
import { OrderManager } from "./order-manager";

interface VeBtcCardProps {
  readonly nft: VeBtcNft;
  readonly snapshot: MarketSnapshot | undefined;
  readonly account: AccountSnapshot;
}

/// The market's fallback gauge: votes no bid buys land here, so the vault always votes.
const isHouseGauge = (nft: VeBtcNft, snapshot: MarketSnapshot | undefined): boolean =>
  snapshot !== undefined && nft.gauge !== undefined && nft.gauge.toLowerCase() === snapshot.fallbackGauge.toLowerCase();

function ApplyBoost({ nft }: { readonly nft: VeBtcNft }) {
  const tx = useJanusTx();
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        The votes on your gauge support <Num value={nft.liveBoost} kind="boost" className="font-semibold" />. Mezo Earn
        still uses <Num value={nft.appliedBoost === 0n ? 10n ** 18n : nft.appliedBoost} kind="boost" /> until someone pokes it.
      </p>
      <Button
        size="sm"
        disabled={!tx.ready}
        loading={tx.busy}
        onClick={() => void tx.send({ ...calls.pokeBoost(nft.id), label: "Applying boost", done: `Boost applied to veBTC NFT #${nft.id}` })}
      >
        <Zap aria-hidden /> Apply boost
      </Button>
    </div>
  );
}

function CreateGauge({ nft }: { readonly nft: VeBtcNft }) {
  const tx = useJanusTx();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        veMEZO votes reach a veBTC NFT through its boost gauge. This NFT has none yet. Creating one is a single
        BoostVoter call, and only the NFT&apos;s owner can make it.
      </p>
      <Button
        disabled={!tx.ready}
        loading={tx.busy}
        onClick={() => void tx.send({ ...calls.createGauge(nft.id), label: "Creating boost gauge", done: `Gauge created for veBTC NFT #${nft.id}` })}
      >
        Create boost gauge
      </Button>
    </div>
  );
}

function Body({ nft, snapshot, account }: VeBtcCardProps) {
  if (!nft.gauge) return <CreateGauge nft={nft} />;
  if (!nft.gaugeAlive) {
    return <p className="text-sm text-muted-foreground">This NFT&apos;s boost gauge was killed, so votes can no longer reach it.</p>;
  }
  if (!snapshot) return <p className="text-sm text-muted-foreground">Reading the market...</p>;
  const order = snapshot.orders.find((o) => o.orderId === nft.orderId);
  if (nft.orderId !== 0n && order) return <OrderManager order={order} snapshot={snapshot} account={account} />;
  if (isHouseGauge(nft, snapshot)) {
    return (
      <p className="text-sm text-muted-foreground">
        This NFT holds the market&apos;s house gauge. Votes that no bid buys land here, so every shard still votes
        each epoch. It needs no bid of its own.
      </p>
    );
  }
  return <OrderForm nft={nft} snapshot={snapshot} account={account} />;
}

export function VeBtcCard({ nft, snapshot, account }: VeBtcCardProps) {
  const stale = staleBoosts([{ tokenId: nft.id, applied: nft.appliedBoost, live: nft.liveBoost }]).length > 0;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">
            <a
              href={nftUrl(veBtcContract.address, nft.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              veBTC NFT #{nft.id.toString()}
              <ExternalLink className="size-3.5 text-muted-foreground" aria-label="opens the Mezo explorer" />
            </a>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <Num value={nft.amount} kind="btc" context="detailed" /> locked,{" "}
            {nft.permanent ? "permanent lock" : `unlocks ${formatUtc(nft.end)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isHouseGauge(nft, snapshot) ? <Badge tone="patina">House gauge</Badge> : null}
          {nft.orderId !== 0n ? <Badge tone="bronze">Bidding</Badge> : null}
          <Badge tone={nft.appliedBoost > 10n ** 18n ? "bronze" : "neutral"}>
            Boost <Num value={nft.appliedBoost === 0n ? 10n ** 18n : nft.appliedBoost} kind="boost" />
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {stale ? <ApplyBoost nft={nft} /> : null}
        <Body nft={nft} snapshot={snapshot} account={account} />
      </CardContent>
    </Card>
  );
}
