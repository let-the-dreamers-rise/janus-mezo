import { Num } from "@/components/num";
import type { MarketSnapshot } from "@/lib/chain/market-snapshot";

const BPS = 10_000n;

/// What the latest round sold and charged, for orders that are still on the book.
export function LastRound({ snapshot }: { readonly snapshot: MarketSnapshot }) {
  const filled = snapshot.orders.filter((order) => order.lastFill !== undefined);
  if (snapshot.round.id === 0n || filled.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No round has sold votes yet.</p>;
  }
  const charged = filled.reduce((sum, order) => sum + (order.lastFill?.charged ?? 0n), 0n);
  const toHolders = charged - (charged * snapshot.feeBps) / BPS;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-muted-foreground">Votes sold</dt>
          <dd className="font-medium"><Num value={snapshot.round.filled} kind="votes" /></dd>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-muted-foreground">Buyers paid</dt>
          <dd className="font-medium"><Num value={charged} kind="musd" /></dd>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-muted-foreground">To jMEZO holders</dt>
          <dd className="font-medium text-patina"><Num value={toHolders} kind="musd" /></dd>
        </div>
      </dl>
      <ul className="divide-y rounded-lg border bg-card text-sm">
        {filled.map((order) => (
          <li key={order.orderId.toString()} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="num">veBTC #{order.tokenId.toString()}</span>
            <span>
              <Num value={order.lastFill?.votes} kind="votes" /> at <Num value={order.lastFill?.pricePerVote} kind="bid" /> / 1k
            </span>
            <span className="font-medium"><Num value={order.lastFill?.charged} kind="musd" /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
