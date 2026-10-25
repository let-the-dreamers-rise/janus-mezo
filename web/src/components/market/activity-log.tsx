"use client";

import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { useActivity } from "@/hooks/use-activity";
import { explorerUrl } from "@/lib/explorer";
import { formatUtc } from "@/lib/time";

/// What this account sent through Janus from this browser. Kept on this device only.
export function ActivityLog({ account }: { readonly account: string | undefined }) {
  const items = useActivity(account);
  if (!account) return null;
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nothing sent from this browser yet. Every call you make here shows up in this list.
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-lg border bg-card text-sm">
      {items.map((item) => (
        <li key={`${item.at}-${item.label}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="flex min-w-0 items-start gap-2">
            {item.status === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-patina" aria-label="Confirmed" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Failed" />
            )}
            <span className="min-w-0">
              <span className="font-medium">{item.label}</span>
              {item.detail ? <span className="block text-muted-foreground">{item.detail}</span> : null}
            </span>
          </span>
          <span className="flex items-center gap-3 text-muted-foreground">
            <time dateTime={new Date(item.at).toISOString()}>{formatUtc(Math.floor(item.at / 1000))}</time>
            {item.hash ? (
              <a
                href={explorerUrl("tx", item.hash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex size-8 items-center justify-center rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open the transaction in the Mezo explorer"
              >
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
