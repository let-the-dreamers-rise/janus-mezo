"use client";

import { Eye, Hammer, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import type { Address } from "viem";
import { DemoWalletButton } from "@/components/onboarding/demo-wallet-button";
import { EmptyState } from "@/components/states";
import { WalletButton } from "@/components/wallet/wallet-button";
import { DEPLOYMENT } from "@/config/deployment";
import { shortAddress } from "@/lib/explorer";

/// The deployer account that holds the seeded demo NFTs, bids and jMEZO.
const DEMO_ACCOUNT = DEPLOYMENT.owner;

export function WatchBanner({ address }: { readonly address: Address }) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2">
        <Eye className="size-4 shrink-0 text-primary" aria-hidden />
        <span>
          Viewing <span className="num">{shortAddress(address)}</span> read-only. Connect a wallet to act.
        </span>
      </p>
      <WalletButton />
    </div>
  );
}

export function NotDeployed() {
  return (
    <EmptyState icon={Hammer} title="Janus is not deployed yet">
      The contracts go live on Mezo Matsnet first. This page fills in once they do.
    </EmptyState>
  );
}

export function ConnectCard({ title, children }: { readonly title: string; readonly children?: ReactNode }) {
  return (
    <EmptyState
      icon={Wallet}
      title={title}
      action={
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            <WalletButton />
            <DemoWalletButton />
          </div>
          <a
            href={`?as=${DEMO_ACCOUNT}`}
            className="rounded-sm text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Or browse the seeded market account read-only
          </a>
        </div>
      }
    >
      {children ??
        "Bitcoin wallets act through their Mezo smart account, so they work here too. No wallet? A demo wallet takes one click and comes with a free starter kit."}
    </EmptyState>
  );
}
