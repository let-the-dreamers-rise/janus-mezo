"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Bitcoin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalletAccount } from "@/lib/wallet/passport";
import { cn } from "@/lib/utils";

const short = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;

/// RainbowKit's flows (connect, account, network) behind Janus buttons. Bitcoin wallets show
/// their BTC address; their Mezo smart account is what holds NFTs and signs calls.
export function WalletButton({ className, label = "Connect wallet" }: { readonly className?: string; readonly label?: string }) {
  const { networkFamily, walletAddress } = useWalletAccount();
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        if (!mounted) {
          return (
            <Button className={cn("invisible", className)} aria-hidden tabIndex={-1}>
              {label}
            </Button>
          );
        }
        if (!account || !chain) {
          return (
            <Button className={className} onClick={openConnectModal}>
              {label}
            </Button>
          );
        }
        if (chain.unsupported) {
          return (
            <Button variant="destructive" className={className} onClick={openChainModal}>
              Switch to Mezo
            </Button>
          );
        }
        const bitcoin = networkFamily === "bitcoin" && walletAddress;
        return (
          <Button variant="outline" className={className} onClick={openAccountModal} aria-label="Open account details">
            {bitcoin ? <Bitcoin className="text-primary" aria-hidden /> : null}
            <span className="num">{bitcoin ? short(walletAddress) : account.displayName}</span>
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
