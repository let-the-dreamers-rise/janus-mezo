"use client";

import { ExternalLink, Inbox } from "lucide-react";
import { Num } from "@/components/num";
import { EmptyState } from "@/components/states";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { veBtcContract } from "@/lib/chain/contracts";
import type { MarketSnapshot } from "@/lib/chain/market-snapshot";
import { nftUrl } from "@/lib/explorer";
import type { FillStatus } from "@/lib/protocol/order-book";

const STATUS: Record<FillStatus, { label: string; tone: BadgeProps["tone"] }> = {
  full: { label: "Fills", tone: "bronze" },
  partial: { label: "Partial", tone: "warning" },
  unfilled: { label: "Waits", tone: "neutral" },
  "at-target": { label: "At target", tone: "patina" },
  ineligible: { label: "Skipped", tone: "destructive" },
};

interface OrderBookProps {
  readonly snapshot: MarketSnapshot;
  /// The connected account, to mark its own bids.
  readonly account: string | undefined;
}

export function OrderBook({ snapshot, account }: OrderBookProps) {
  if (snapshot.projection.length === 0) {
    return (
      <EmptyState icon={Inbox} title="No bids yet" action={<ButtonLink href="/boost/">Place the first bid</ButtonLink>}>
        Bids appear here ranked the way the next round will fill them.
      </EmptyState>
    );
  }
  const mine = account?.toLowerCase();
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Projected with <Num value={snapshot.projectedSupply} kind="votes" />{" "}
        {snapshot.projectionScope === "next-epoch"
          ? "for next epoch's round. Every shard has already voted this epoch."
          : "for a round started now."}
        {snapshot.projectionExact ? "" : " Some carried-over votes could not be read, so needs may be overstated."}
      </p>
      <div className="relative overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Standing bids in the order the next round fills them</caption>
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Rank</th>
              <th scope="col" className="px-4 py-3 font-medium">veBTC NFT</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Bid, MUSD / 1k votes</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Target</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Escrow</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Votes</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Boost after</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {snapshot.projection.map((p) => {
              const status = STATUS[p.status];
              const own = mine !== undefined && p.entry.owner.toLowerCase() === mine;
              return (
                <tr key={p.entry.orderId.toString()} className={own ? "bg-primary/5" : undefined}>
                  <td className="num px-4 py-3">{p.rank}</td>
                  <td className="px-4 py-3">
                    <a
                      href={nftUrl(veBtcContract.address, p.entry.tokenId)}
                      target="_blank"
                      rel="noreferrer"
                      className="num inline-flex items-center gap-1 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      #{p.entry.tokenId.toString()}
                      <ExternalLink className="size-3 text-muted-foreground" aria-label="opens the Mezo explorer" />
                    </a>
                    {own ? <Badge tone="bronze" className="ml-2">You</Badge> : null}
                  </td>
                  <td className="px-4 py-3 text-right"><Num value={p.entry.pricePerVote} kind="bid" bare /></td>
                  <td className="px-4 py-3 text-right"><Num value={p.entry.targetBoost} kind="boost" /></td>
                  <td className="px-4 py-3 text-right"><Num value={p.entry.escrow} kind="musd" bare /></td>
                  <td className="px-4 py-3 text-right"><Num value={p.votes} kind="votes" bare /></td>
                  <td className="px-4 py-3 text-right"><Num value={p.boostAfter} kind="boost" /></td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {p.reason ? <span className="mt-1 block text-xs text-muted-foreground">{p.reason}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
