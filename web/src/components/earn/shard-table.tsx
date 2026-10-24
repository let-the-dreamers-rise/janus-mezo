"use client";

import { Num } from "@/components/num";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useJanusTx } from "@/hooks/use-janus-tx";
import type { ShardView } from "@/lib/chain/market-snapshot";
import { calls } from "@/lib/chain/calls";

function RedeemButton({ shard, jmezo }: { readonly shard: ShardView; readonly jmezo: bigint | undefined }) {
  const tx = useJanusTx();
  const enough = jmezo !== undefined && jmezo >= shard.amount;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!tx.ready || !enough}>
          Redeem
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Redeem veMEZO NFT #${shard.id}?`}
        description={
          <>
            This burns <Num value={shard.amount} kind="jmezo" /> and sends the NFT to this account. The lock stays
            permanent, and votes it already cast stay in place for this epoch.
          </>
        }
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Not now</Button>
          </DialogClose>
          <Button
            loading={tx.busy}
            onClick={() => void tx.send({ ...calls.redeem(shard.id), label: "Redeeming shard", done: `veMEZO NFT #${shard.id} redeemed` })}
          >
            Burn jMEZO and redeem
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ShardTableProps {
  readonly shards: readonly ShardView[];
  /// The connected account's jMEZO, or undefined when no wallet is connected.
  readonly jmezo: bigint | undefined;
}

export function ShardTable({ shards, jmezo }: ShardTableProps) {
  if (shards.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">The vault holds no shards yet.</p>;
  }
  return (
    <div className="relative overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[520px] text-sm">
        <caption className="sr-only">veMEZO shards held by the Janus vault</caption>
        <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Shard</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Locked</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Votes</th>
            <th scope="col" className="px-4 py-3 font-medium">This epoch</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {shards.map((shard) => (
            <tr key={shard.id.toString()}>
              <td className="num px-4 py-3">#{shard.id.toString()}</td>
              <td className="px-4 py-3 text-right"><Num value={shard.amount} kind="mezo" /></td>
              <td className="px-4 py-3 text-right"><Num value={shard.power} kind="votes" bare /></td>
              <td className="px-4 py-3">
                {shard.eligible ? <Badge tone="patina">Ready to sell</Badge> : <Badge>Voted</Badge>}
              </td>
              <td className="px-4 py-3 text-right"><RedeemButton shard={shard} jmezo={jmezo} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
