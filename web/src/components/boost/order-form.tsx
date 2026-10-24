"use client";

import { useState } from "react";
import { Num } from "@/components/num";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { useJanusTx } from "@/hooks/use-janus-tx";
import type { AccountSnapshot, VeBtcNft } from "@/lib/chain/account-snapshot";
import { calls } from "@/lib/chain/calls";
import type { MarketSnapshot } from "@/lib/chain/market-snapshot";
import {
  TARGET_MAX,
  TARGET_MIN,
  TARGET_STEP,
  checkAmount,
  checkQuote,
  describeFill,
  previewBid,
  roundsCovered,
  suggestedEscrow,
  targetFromHundredths,
} from "@/lib/protocol/bid";
import { additionalVotes } from "@/lib/protocol/boost-math";
import { costOfVotes, quoteFromPricePerVote, toRaw } from "@/lib/protocol/units";

const SUGGESTED_ROUNDS = 4n;

interface OrderFormProps {
  readonly nft: VeBtcNft;
  readonly snapshot: MarketSnapshot;
  readonly account: AccountSnapshot;
}

/// Two decimals, rounded up, so a suggested escrow never falls short.
const musdInput = (amount: bigint): string => toRaw(((amount + 10n ** 16n - 1n) / 10n ** 16n) * 10n ** 16n);

export function OrderForm({ nft, snapshot, account }: OrderFormProps) {
  const topQuote = snapshot.orders.reduce((max, order) => (order.pricePerVote > max ? order.pricePerVote : max), 0n);
  const [hundredths, setHundredths] = useState(TARGET_MAX);
  const [quote, setQuote] = useState(topQuote > 0n ? toRaw(quoteFromPricePerVote(topQuote)) : "50");
  const [escrow, setEscrow] = useState("");
  const approve = useJanusTx();
  const place = useJanusTx();

  const target = targetFromHundredths(hundredths);
  const price = checkQuote(quote, snapshot.minPricePerVote);
  const amount = checkAmount(escrow, account.musd);
  const { votingTotal, boostableTotal } = snapshot.totals;
  const need = additionalVotes(votingTotal, boostableTotal, nft.boostable, target, nft.gaugeWeight);
  const perRound = price.ok && need !== null ? costOfVotes(need, price.value) : null;
  const suggestion = price.ok ? suggestedEscrow(need, price.value, SUGGESTED_ROUNDS) : null;
  const rounds = price.ok && amount.ok ? roundsCovered(amount.value, need, price.value) : null;

  // An empty escrow previews the suggested one, so the fill reads before anything is typed.
  const usingSuggestion = escrow.trim() === "" && suggestion !== null;
  const previewEscrow = amount.ok ? amount.value : escrow.trim() === "" ? (suggestion ?? 0n) : null;
  const nextId = snapshot.orders.reduce((max, order) => (order.orderId > max ? order.orderId : max), 0n) + 1n;
  const preview =
    price.ok && nft.gauge && previewEscrow !== null
      ? previewBid(
          snapshot.projection.map((p) => p.entry),
          {
            orderId: nextId,
            owner: account.address,
            tokenId: nft.id,
            pricePerVote: price.value,
            targetBoost: target,
            escrow: previewEscrow,
            nftOwner: account.address,
            gauge: nft.gauge,
            gaugeAlive: nft.gaugeAlive,
            boostable: nft.boostable,
            gaugeWeight: nft.gaugeWeight,
          },
          snapshot.projectedSupply,
          snapshot.totals,
          snapshot.minPricePerVote,
        )
      : undefined;

  const scope = snapshot.projectionScope === "next-epoch" ? "In next epoch's round" : "If a round settled now";
  const previewLabel = usingSuggestion ? `${scope}, with ${SUGGESTED_ROUNDS.toString()} rounds of escrow` : scope;
  const previewText = preview
    ? describeFill(preview)
    : price.ok
      ? "Enter a valid escrow to see where this bid lands."
      : "Enter a valid bid to see where it lands.";

  const ready = price.ok && amount.ok;
  const needsApproval = amount.ok && account.musdAllowance < amount.value;
  const busy = approve.busy || place.busy;

  const submit = async () => {
    if (!price.ok || !amount.ok) return;
    if (needsApproval) {
      await approve.send({ ...calls.approveMusd(amount.value), label: "Approving MUSD", done: "MUSD approved" });
      return;
    }
    const receipt = await place.send({
      ...calls.placeOrder(nft.id, price.value, target, amount.value),
      label: "Placing bid",
      done: `Bid placed for veBTC NFT #${nft.id}`,
    });
    if (receipt) setEscrow("");
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Target boost</span>
          <span className="num">{(hundredths / 100).toFixed(2)}x</span>
        </div>
        <Slider
          min={TARGET_MIN}
          max={TARGET_MAX}
          step={TARGET_STEP}
          value={[hundredths]}
          onValueChange={([value]) => setHundredths(value ?? TARGET_MAX)}
          thumbLabel="Target boost"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Bid"
          unit="MUSD / 1k votes"
          inputMode="decimal"
          autoComplete="off"
          value={quote}
          onChange={(event) => setQuote(event.target.value)}
          error={quote !== "" && !price.ok ? price.message : undefined}
          hint={topQuote > 0n ? <>Highest bid now: <Num value={topQuote} kind="bid" /> per 1k votes</> : "Bids fill highest first."}
        />
        <Field
          label="Escrow"
          unit="MUSD"
          inputMode="decimal"
          autoComplete="off"
          placeholder={suggestion !== null ? musdInput(suggestion) : "0.00"}
          value={escrow}
          onChange={(event) => setEscrow(event.target.value)}
          error={escrow !== "" && !amount.ok ? amount.message : undefined}
          hint={<>Balance: <Num value={account.musd} kind="musd" /></>}
          action={
            suggestion !== null ? (
              <button
                type="button"
                onClick={() => setEscrow(musdInput(suggestion))}
                className="rounded-sm text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Use {SUGGESTED_ROUNDS.toString()} rounds
              </button>
            ) : undefined
          }
        />
      </div>
      <dl className="grid gap-x-4 gap-y-3 rounded-lg bg-muted/60 p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Votes to reach {(hundredths / 100).toFixed(2)}x</dt>
          <dd className="font-medium"><Num value={need} kind="votes" /></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cost per round</dt>
          <dd className="font-medium"><Num value={perRound} kind="musd" /></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Escrow covers</dt>
          <dd className="font-medium">{rounds === null ? "--" : `${rounds.toString()} ${rounds === 1n ? "round" : "rounds"}`}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-muted-foreground">{previewLabel}</dt>
          <dd>
            {previewText}{" "}
            {preview && preview.votes > 0n ? <>Boost after: <Num value={preview.boostAfter} kind="boost" />.</> : null}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!place.ready || !ready || busy} loading={busy}>
          {needsApproval && amount.ok ? <>Approve <Num value={amount.value} kind="musd" /></> : "Place bid"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {needsApproval
            ? "Step 1 of 2. The market can only move MUSD you approve."
            : "Your escrow stays in the market. You pay only for votes that land on your gauge."}
        </p>
      </div>
    </form>
  );
}
