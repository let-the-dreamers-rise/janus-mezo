"use client";

import { useState } from "react";
import { Num, SATS_BELOW } from "@/components/num";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import type { MarketSnapshot } from "@/lib/chain/market-snapshot";
import { TARGET_MAX, TARGET_MIN, TARGET_STEP, checkQuote, targetFromHundredths } from "@/lib/protocol/bid";
import { votesForBoost } from "@/lib/protocol/boost-math";
import { costOfVotes, parseDecimal } from "@/lib/protocol/units";

const PERCENT_SCALE = 10_000n;
/// 1,000 sats, the size of the demo locks on matsnet, so the first numbers are realistic there.
const DEFAULT_BTC = "0.00001";

export function QuoteCalculator({ snapshot }: { readonly snapshot: MarketSnapshot | undefined }) {
  const [btc, setBtc] = useState(DEFAULT_BTC);
  const [hundredths, setHundredths] = useState(TARGET_MAX);
  const [quote, setQuote] = useState("50");

  const power = parseDecimal(btc);
  const price = snapshot ? checkQuote(quote, snapshot.minPricePerVote) : undefined;
  const totals = snapshot?.totals;
  const votes =
    totals && power !== null && power > 0n
      ? votesForBoost(totals.votingTotal, totals.boostableTotal + power, power, targetFromHundredths(hundredths))
      : null;
  const cost = votes !== null && price?.ok ? costOfVotes(votes, price.value) : null;
  const supply = snapshot?.vault.votingPower;
  const share = votes !== null && supply ? Number((votes * PERCENT_SCALE) / supply) / 100 : null;
  const beyondVault = votes !== null && supply !== undefined && supply > 0n && votes > supply;
  const inSats = power !== null && power > 0n && power < SATS_BELOW;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">What would boost cost?</CardTitle>
        <CardDescription>No wallet needed. Priced against live Mezo totals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field
          label="BTC locked in veBTC"
          unit="BTC"
          inputMode="decimal"
          autoComplete="off"
          value={btc}
          onChange={(event) => setBtc(event.target.value)}
          error={power === null ? "Enter an amount of BTC." : undefined}
          hint={inSats ? <>That is <Num value={power} kind="btc" context="detailed" />.</> : undefined}
        />
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
        <Field
          label="Bid"
          unit="MUSD / 1k votes"
          inputMode="decimal"
          autoComplete="off"
          value={quote}
          onChange={(event) => setQuote(event.target.value)}
          error={price && !price.ok ? price.message : undefined}
        />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/60 p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Votes needed each epoch</dt>
            <dd className="font-medium"><Num value={votes} kind="votes" /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cost each epoch</dt>
            <dd className="font-medium"><Num value={cost} kind="musd" /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Votes in the vault</dt>
            <dd className="font-medium"><Num value={supply} kind="votes" /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Share of the vault</dt>
            <dd className="font-medium"><Num value={share} kind="percent" /></dd>
          </div>
        </dl>
        {beyondVault ? (
          <p className="text-sm text-warning">
            That is more votes than the vault holds, so a bid this size would fill in part until more veMEZO joins.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          BoostVoter sets boost to 1 + 4 x (your gauge&apos;s share of all veMEZO votes) / (your NFT&apos;s share of all
          veBTC power), capped at 5x. Janus prices bids with the same integer math.
        </p>
      </CardContent>
    </Card>
  );
}
