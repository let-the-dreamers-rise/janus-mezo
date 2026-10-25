"use client";

import { Num } from "@/components/num";
import { ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoundHistory } from "@/hooks/use-round-history";
import { formatUtc } from "@/lib/time";

/// Every round since deployment, from the chain.
export function RoundHistory() {
  const history = useRoundHistory();
  if (history.isError) {
    return <ErrorState title="Could not read past rounds" error={history.error} onRetry={() => void history.refetch()} />;
  }
  if (!history.data) return <Skeleton className="h-32" aria-label="Loading past rounds" />;
  if (history.data.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No round has started yet.</p>;
  }
  return (
    <div className="relative overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Rounds since deployment, newest first</caption>
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Round</th>
            <th scope="col" className="px-4 py-3 font-medium">Epoch</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Shards</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Votes sold</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Buyers paid</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">To jMEZO</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {history.data.map((row) => (
            <tr key={row.roundId.toString()}>
              <td className="num px-4 py-3 font-medium">#{row.roundId.toString()}</td>
              <td className="px-4 py-3">{formatUtc(row.epoch)}</td>
              <td className="num px-4 py-3 text-right">{row.shards.toString()}</td>
              <td className="px-4 py-3 text-right"><Num value={row.filled} kind="votes" bare /></td>
              <td className="px-4 py-3 text-right"><Num value={row.charged} kind="musd" /></td>
              <td className="px-4 py-3 text-right text-patina"><Num value={row.toHolders} kind="musd" /></td>
              <td className="px-4 py-3">
                {row.finalized ? <Badge tone="patina">Paid out</Badge> : <Badge tone="bronze">In progress</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
