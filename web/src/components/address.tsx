"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Address as Hex20 } from "viem";
import { explorerUrl, shortAddress } from "@/lib/explorer";
import { cn } from "@/lib/utils";

interface AddressProps {
  readonly address: Hex20;
  readonly label?: string;
  readonly className?: string;
}

/// A short address with copy and explorer actions. Copy puts the full address on the clipboard.
export function Address({ address, label, className }: AddressProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <span className="num text-sm" title={address}>
        {label ?? shortAddress(address)}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Address copied" : "Copy address"}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
      <a
        href={explorerUrl("address", address)}
        target="_blank"
        rel="noreferrer"
        aria-label="Open in the Mezo explorer"
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </span>
  );
}
