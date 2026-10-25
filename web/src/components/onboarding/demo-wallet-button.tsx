"use client";

import { KeyRound } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useDemoWallet } from "@/hooks/use-demo-wallet";
import { useMounted } from "@/hooks/use-mounted";

interface DemoWalletButtonProps {
  readonly className?: string;
  readonly variant?: ButtonProps["variant"];
  readonly size?: ButtonProps["size"];
  readonly label?: string;
  readonly onConnected?: () => void;
}

/// One click to a working wallet: a fresh testnet key made and kept in this browser.
/// Renders nothing once the demo wallet is the connected one.
export function DemoWalletButton({
  className,
  variant = "outline",
  size,
  label = "Try with a demo wallet",
  onConnected,
}: DemoWalletButtonProps) {
  const demo = useDemoWallet();
  const mounted = useMounted();
  if (mounted && demo.active) return null;
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      loading={demo.connecting}
      disabled={!mounted || !demo.available}
      onClick={async () => {
        if (await demo.connect()) onConnected?.();
      }}
    >
      {demo.connecting ? null : <KeyRound aria-hidden />}
      {label}
    </Button>
  );
}
