"use client";

import { useState } from "react";
import { Num } from "@/components/num";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { useJanusTx } from "@/hooks/use-janus-tx";
import type { AccountSnapshot } from "@/lib/chain/account-snapshot";
import { calls } from "@/lib/chain/calls";
import type { MarketSnapshot, OrderView } from "@/lib/chain/market-snapshot";
import {
  TARGET_MAX,
  TARGET_MIN,
  TARGET_STEP,
  checkAmount,
  checkQuote,
  describeFill,
  hundredthsFromTarget,
  previewBid,
  targetFromHundredths,
} from "@/lib/protocol/bid";
import { PHASE } from "@/lib/protocol/round-step";
import { quoteFromPricePerVote, toRaw } from "@/lib/protocol/units";
import { cn } from "@/lib/utils";

type Mode = "change" | "topUp";

interface OrderManagerProps {
  readonly order: OrderView;
  readonly snapshot: MarketSnapshot;
  readonly account: AccountSnapshot;
}

function ChangeBid({ order, snapshot }: Omit<OrderManagerProps, "account">) {
  const [quote, setQuote] = useState(toRaw(quoteFromPricePerVote(order.pricePerVote)));
  const [hundredths, setHundredths] = useState(hundredthsFromTarget(order.targetBoost));
  const tx = useJanusTx();
  const price = checkQuote(quote, snapshot.minPricePerVote);
  const target = targetFromHundredths(hundredths);
  const entries = snapshot.projection.map((p) => p.entry);
  const current = entries.find((entry) => entry.orderId === order.orderId);
  const preview =
    price.ok && current
      ? previewBid(entries, { ...current, pricePerVote: price.value, targetBoost: target }, snapshot.projectedSupply, snapshot.totals, snapshot.minPricePerVote)
      : undefined;
  const unchanged = price.ok && price.value === order.pricePerVote && target === order.targetBoost;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (price.ok) void tx.send({ ...calls.updateOrder(order.orderId, price.value, target), label: "Updating bid", done: "Bid updated" });
      }}
    >
      <div className="space-y-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Target boost</span>
          <span className="num">{(hundredths / 100).toFixed(2)}x</span>
        </div>
        <Slider min={TARGET_MIN} max={TARGET_MAX} step={TARGET_STEP} value={[hundredths]} onValueChange={([v]) => setHundredths(v ?? TARGET_MAX)} thumbLabel="Target boost" />
      </div>
      <Field
        label="Bid"
        unit="MUSD / 1k votes"
        inputMode="decimal"
        autoComplete="off"
        value={quote}
        onChange={(event) => setQuote(event.target.value)}
        error={!price.ok ? price.message : undefined}
        hint={describeFill(preview)}
      />
      <Button type="submit" disabled={!tx.ready || !price.ok || unchanged || tx.busy} loading={tx.busy}>
        Update bid
      </Button>
    </form>
  );
}

function TopUp({ order, account }: Omit<OrderManagerProps, "snapshot">) {
  const [input, setInput] = useState("");
  const approve = useJanusTx();
  const add = useJanusTx();
  const amount = checkAmount(input, account.musd);
  const needsApproval = amount.ok && account.musdAllowance < amount.value;
  const busy = approve.busy || add.busy;
  const submit = async () => {
    if (!amount.ok) return;
    if (needsApproval) {
      await approve.send({ ...calls.approveMusd(amount.value), label: "Approving MUSD", done: "MUSD approved" });
      return;
    }
    const receipt = await add.send({ ...calls.topUp(order.orderId, amount.value), label: "Adding escrow", done: "Escrow added" });
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
      <Field
        label="Add to escrow"
        unit="MUSD"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        error={input !== "" && !amount.ok ? amount.message : undefined}
        hint={<>Balance: <Num value={account.musd} kind="musd" /></>}
      />
      <Button type="submit" disabled={!add.ready || !amount.ok || busy} loading={busy}>
        {needsApproval ? "Approve MUSD" : "Add escrow"}
      </Button>
    </form>
  );
}

function CancelOrder({ order }: { readonly order: OrderView }) {
  const tx = useJanusTx();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={!tx.ready}>
          Cancel bid
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Cancel the bid for veBTC NFT #${order.tokenId}?`}
        description={
          <>
            Cancelling returns <Num value={order.escrow} kind="musd" /> to this account now. Votes already on your gauge
            stay until the next round resets them.
          </>
        }
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Keep bid</Button>
          </DialogClose>
          <Button
            variant="destructive"
            loading={tx.busy}
            onClick={() => void tx.send({ ...calls.cancelOrder(order.orderId), label: "Cancelling bid", done: "Bid cancelled, escrow returned" })}
          >
            Cancel bid
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OrderManager({ order, snapshot, account }: OrderManagerProps) {
  const [mode, setMode] = useState<Mode | undefined>(undefined);
  const projection = snapshot.projection.find((p) => p.entry.orderId === order.orderId);
  const charging = snapshot.round.phase === PHASE.Voting || snapshot.round.phase === PHASE.Voted;
  const locked = charging && snapshot.roundOrderIds.includes(order.orderId);

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Your bid</dt>
          <dd className="font-medium"><Num value={order.pricePerVote} kind="bid" /> <span className="text-muted-foreground">/ 1k votes</span></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Target</dt>
          <dd className="font-medium"><Num value={order.targetBoost} kind="boost" /></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Escrow left</dt>
          <dd className="font-medium"><Num value={order.escrow} kind="musd" /></dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last round</dt>
          <dd className="font-medium">
            {order.lastFill ? <><Num value={order.lastFill.votes} kind="votes" /> for <Num value={order.lastFill.charged} kind="musd" /></> : "Not filled"}
          </dd>
        </div>
        <div className="sm:col-span-4">
          <dt className="text-muted-foreground">{snapshot.projectionScope === "next-epoch" ? "In next epoch's round" : "If a round settled now"}</dt>
          <dd>
            {describeFill(projection)}{" "}
            {projection && projection.votes > 0n ? <>Boost after: <Num value={projection.boostAfter} kind="boost" />.</> : null}
          </dd>
        </div>
      </dl>
      {locked ? (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          This bid is in the round being charged, so it is locked until the round finalizes.
        </p>
      ) : (
        <>
          <div role="group" aria-label="Manage this bid" className="flex flex-wrap gap-2">
            {([["change", "Change bid"], ["topUp", "Add escrow"]] as const).map(([value, label]) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                aria-pressed={mode === value}
                className={cn(mode === value && "border-primary text-primary")}
                onClick={() => setMode(mode === value ? undefined : value)}
              >
                {label}
              </Button>
            ))}
            <CancelOrder order={order} />
          </div>
          {mode === "change" ? <ChangeBid order={order} snapshot={snapshot} /> : null}
          {mode === "topUp" ? <TopUp order={order} account={account} /> : null}
        </>
      )}
    </div>
  );
}
