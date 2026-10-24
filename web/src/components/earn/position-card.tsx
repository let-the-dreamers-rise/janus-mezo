"use client";

import { Num } from "@/components/num";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJanusTx } from "@/hooks/use-janus-tx";
import type { AccountSnapshot } from "@/lib/chain/account-snapshot";
import { calls } from "@/lib/chain/calls";

const PERCENT_SCALE = 10_000n;

export function PositionCard({ account, supply }: { readonly account: AccountSnapshot; readonly supply: bigint | undefined }) {
  const tx = useJanusTx();
  const share = supply && supply > 0n ? Number((account.jmezo * PERCENT_SCALE) / supply) / 100 : null;
  return (
    <Card className="border-patina/30">
      <CardHeader>
        <CardTitle className="text-lg">Your position</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">jMEZO</dt>
            <dd className="text-xl font-semibold"><Num value={account.jmezo} kind="jmezo" /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Share of the vault</dt>
            <dd className="text-xl font-semibold"><Num value={share} kind="percent" /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Claimable now</dt>
            <dd className="text-xl font-semibold text-patina"><Num value={account.claimable} kind="musd" /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Claimed so far</dt>
            <dd className="text-xl font-semibold"><Num value={account.claimed} kind="musd" /></dd>
          </div>
        </dl>
        <Button
          variant="patina"
          className="w-full"
          disabled={!tx.ready || account.claimable === 0n || tx.busy}
          loading={tx.busy}
          onClick={() => void tx.send({ ...calls.claim(), label: "Claiming MUSD", done: "MUSD claimed" })}
        >
          {account.claimable === 0n ? "Nothing to claim yet" : <>Claim <Num value={account.claimable} kind="musd" /></>}
        </Button>
      </CardContent>
    </Card>
  );
}
