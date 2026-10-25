"use client";

import { Check, Circle, ExternalLink, Gift } from "lucide-react";
import type { Address } from "viem";
import { Num } from "@/components/num";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SITE } from "@/config/site";
import { useJanusAccount } from "@/hooks/use-janus-account";
import { useStarterKit } from "@/hooks/use-starter-kit";
import { explorerUrl } from "@/lib/explorer";
import type { KitClaim, KitStatus } from "@/lib/starter-kit/client";
import { KIT, KIT_KINDS, wanted, type KitKind } from "@/lib/starter-kit/kit";
import { KIT_LABELS, holdingsOf, listOf } from "@/lib/starter-kit/view";
import { cn } from "@/lib/utils";
import { DemoWalletButton } from "./demo-wallet-button";

type Amounts = Readonly<Record<KitKind, bigint>>;

const DEFAULT_AMOUNTS: Amounts = { gas: KIT.gas, musd: KIT.musd, veBtc: KIT.veBtc, veMezo: KIT.veMezo };
const VE_BTC_WEEKS = Number(KIT.veBtcLock / 604_800n);

function ItemLabel({ kind, amounts }: { readonly kind: KitKind; readonly amounts: Amounts }) {
  switch (kind) {
    case "gas":
      return (
        <>
          <Num value={amounts.gas} kind="btc" /> of BTC for gas
        </>
      );
    case "musd":
      return (
        <>
          <Num value={amounts.musd} kind="musd" /> to bid with
        </>
      );
    case "veBtc":
      return (
        <>
          A veBTC NFT with <Num value={amounts.veBtc} kind="btc" /> locked for up to {VE_BTC_WEEKS} weeks
        </>
      );
    case "veMezo":
      return (
        <>
          A veMEZO NFT with <Num value={amounts.veMezo} kind="mezo" /> locked
        </>
      );
  }
}

function Unavailable({ reason }: { readonly reason: KitStatus["reason"] }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        {reason === "not-configured"
          ? "The starter kit is off on this deployment."
          : "The starter kit is out of stock right now."}{" "}
        The Mezo faucet hands out testnet BTC and MEZO too.
      </p>
      <ButtonLink href={SITE.faucetUrl} variant="outline" size="sm">
        Open the Mezo faucet <ExternalLink aria-hidden />
      </ButtonLink>
    </div>
  );
}

function StockNote({ status }: { readonly status: KitStatus }) {
  if (!status.left) return null;
  const left = status.left;
  const out = KIT_KINDS.filter((kind) => left[kind] === 0n).map((kind) => KIT_LABELS[kind]);
  if (out.length > 0) {
    return <span className="text-sm text-muted-foreground">Out of {listOf(out)} for now; the rest still comes.</span>;
  }
  return (
    <span className="text-sm text-muted-foreground">
      <span className="num">{left.full.toString()}</span> kits left
    </span>
  );
}

function Receipt({ claim }: { readonly claim: KitClaim }) {
  if (claim.sent.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
      <p className="font-medium">Sent to your wallet</p>
      <ul className="space-y-1">
        {claim.sent.map((item) => (
          <li key={item.hash}>
            <a
              href={explorerUrl("tx", item.hash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {KIT_LABELS[item.kind]}
              {item.tokenId === undefined ? "" : ` #${item.tokenId.toString()}`}
              <ExternalLink className="size-3" aria-label="opens the Mezo explorer" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ActionProps {
  readonly address: Address | undefined;
  readonly readOnly: boolean;
  readonly missing: number | undefined;
}

function KitAction({ address, readOnly, missing }: ActionProps) {
  const { status, claim } = useStarterKit();
  if (!address) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Connect a wallet first, or let Janus make a demo wallet for you.</p>
        <DemoWalletButton variant="default" />
      </div>
    );
  }
  if (readOnly) return <p className="text-sm text-muted-foreground">This is a read-only preview. Connect a wallet to get a kit.</p>;
  if (missing === undefined || status.isPending) return <Skeleton className="h-10 w-52" />;
  if (status.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not check the starter kit.{" "}
        <Button variant="link" onClick={() => void status.refetch()}>
          Try again
        </Button>
      </p>
    );
  }
  if (!status.data.available) return <Unavailable reason={status.data.reason} />;
  if (missing === 0) {
    return (
      <>
        <p className="flex items-center gap-2 text-sm font-medium text-patina">
          <Check className="size-4" aria-hidden /> Your wallet has everything in the kit.
        </p>
        {claim.data ? <Receipt claim={claim.data} /> : null}
      </>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button loading={claim.isPending} onClick={() => claim.mutate(address)}>
          {claim.isPending ? "Sending your kit" : "Get the starter kit"}
        </Button>
        <StockNote status={status.data} />
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {claim.isPending
          ? "Mezo confirms each item before the next, so this takes about half a minute."
          : "Free, testnet only, at most two kits per wallet a day."}
      </p>
      {claim.error ? (
        <p role="alert" className="text-sm text-destructive">
          {claim.error.message}
        </p>
      ) : null}
      {claim.data ? <Receipt claim={claim.data} /> : null}
    </div>
  );
}

/// The starter kit: what it holds, what the wallet already has, and the button that sends
/// the rest from the Janus faucet wallet.
export function StarterKitCard({ className }: { readonly className?: string }) {
  const account = useJanusAccount();
  const { status } = useStarterKit();
  const amounts = status.data?.kit ?? DEFAULT_AMOUNTS;
  const missing = account.data ? new Set(wanted(holdingsOf(account.data)).map((item) => item.kind)) : undefined;
  return (
    <Card className={cn("border-primary/30", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Gift className="size-4 text-primary" aria-hidden /> Starter kit
          </CardTitle>
          <Badge>Testnet, free</Badge>
        </div>
        <CardDescription>Everything you need to try both sides of Janus, sent by the Janus faucet wallet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-2.5 text-sm">
          {KIT_KINDS.map((kind) => {
            const have = missing !== undefined && !missing.has(kind);
            return (
              <li key={kind} className="flex items-start gap-2.5">
                {have ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-patina" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span>
                  {missing === undefined ? null : <span className="sr-only">{have ? "In your wallet: " : "Not yet: "}</span>}
                  <ItemLabel kind={kind} amounts={amounts} />
                </span>
              </li>
            );
          })}
        </ul>
        <KitAction address={account.address} readOnly={account.readOnly} missing={missing?.size} />
      </CardContent>
    </Card>
  );
}
