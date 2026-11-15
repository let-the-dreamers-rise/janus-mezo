"use client";

import { RefreshCw } from "lucide-react";
import { useReadContract } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEPLOYMENT } from "@/config/deployment";
import { useJanusTx } from "@/hooks/use-janus-tx";
import type { VeBtcNft } from "@/lib/chain/account-snapshot";
import { calls } from "@/lib/chain/calls";
import { veBtcContract } from "@/lib/chain/contracts";
import { activeChain } from "@/lib/wallet/passport";

/// Lets a veBTC holder turn the autopilot on or off. On means the NFT approves the
/// VeBtcAutopilot contract, which the keeper calls each week to push the lock back to the
/// 28-day maximum. The contract can only extend the lock, never move the NFT.
export function AutopilotToggle({ nft }: { readonly nft: VeBtcNft }) {
  const tx = useJanusTx();
  const autopilot = DEPLOYMENT.autopilot;
  const approved = useReadContract({
    ...veBtcContract,
    functionName: "getApproved",
    args: [nft.id],
    chainId: activeChain.id,
    query: { enabled: autopilot !== undefined && !nft.permanent },
  });
  if (!autopilot || nft.permanent) return null;

  const on = approved.data !== undefined && approved.data.toLowerCase() === autopilot.toLowerCase();
  const send = () =>
    void tx.send(
      on
        ? { ...calls.autopilotOff(nft.id), label: "Turning autopilot off", done: `Autopilot off for veBTC NFT #${nft.id}` }
        : { ...calls.autopilotOn(autopilot, nft.id), label: "Turning autopilot on", done: `Autopilot on for veBTC NFT #${nft.id}` },
    );

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          Autopilot {approved.isLoading ? null : <Badge tone={on ? "patina" : "neutral"}>{on ? "On" : "Off"}</Badge>}
        </p>
        <p className="text-sm text-muted-foreground">
          Re-locks this NFT to the 28-day maximum every week so its boost never decays. It can only extend the lock,
          never move the NFT. Turn it off any time.
        </p>
        {approved.isError ? <p className="text-sm text-destructive">Could not read the autopilot status.</p> : null}
      </div>
      <Button size="sm" variant={on ? "outline" : "default"} disabled={!tx.ready || approved.isLoading} loading={tx.busy} onClick={send}>
        <RefreshCw aria-hidden /> {on ? "Turn off" : "Turn on"}
      </Button>
    </div>
  );
}
