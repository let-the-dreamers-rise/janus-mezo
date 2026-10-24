"use client";

import { Lock } from "lucide-react";
import { Num } from "@/components/num";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useJanusTx } from "@/hooks/use-janus-tx";
import type { AccountSnapshot, VeMezoNft } from "@/lib/chain/account-snapshot";
import { calls } from "@/lib/chain/calls";
import { formatUtc } from "@/lib/time";

function DepositButton({ nft, owner }: { readonly nft: VeMezoNft; readonly owner: AccountSnapshot["address"] }) {
  const tx = useJanusTx();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="patina" size="sm" disabled={!tx.ready || Boolean(nft.blocker)}>
          Deposit
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Deposit veMEZO NFT #${nft.id}?`}
        description={
          <>
            Depositing makes this lock permanent. You receive <Num value={nft.amount} kind="jmezo" />, which earns 90% of
            what buyers pay for the vault&apos;s votes. To take this NFT back, burn the same amount of jMEZO.
          </>
        }
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Not now</Button>
          </DialogClose>
          <Button
            variant="patina"
            loading={tx.busy}
            onClick={() =>
              void tx.send({
                ...calls.depositShard(owner, nft.id),
                label: "Depositing veMEZO",
                done: `veMEZO NFT #${nft.id} deposited, jMEZO minted`,
              })
            }
          >
            Deposit and lock permanently
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DepositList({ account }: { readonly account: AccountSnapshot }) {
  if (account.veMezo.length === 0) {
    return (
      <EmptyState icon={Lock} title="No veMEZO NFTs in this account">
        Lock MEZO in Mezo&apos;s veMEZO to get one. Every lock of at least 1 MEZO can join the vault.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {account.veMezo.map((nft) => (
        <li key={nft.id.toString()} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">
              veMEZO NFT <span className="num">#{nft.id.toString()}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              <Num value={nft.amount} kind="mezo" /> locked, <Num value={nft.power} kind="votes" />,{" "}
              {nft.permanent ? "permanent" : `unlocks ${formatUtc(nft.end)}`}
            </p>
            {nft.blocker ? <p className="text-sm text-warning">{nft.blocker}</p> : null}
            {!nft.blocker && nft.votedThisEpoch ? (
              <p className="text-sm text-muted-foreground">Voted this epoch, so the vault sells it from next epoch.</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {nft.permanent ? <Badge>Permanent</Badge> : null}
            <DepositButton nft={nft} owner={account.address} />
          </div>
        </li>
      ))}
    </ul>
  );
}
