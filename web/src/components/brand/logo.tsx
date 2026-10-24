import { cn } from "@/lib/utils";

/// The split coin: a Roman as with a bronze face and a patina face. See brand.md.
export function CoinMark({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <circle cx="16" cy="16" r="15" className="fill-none stroke-foreground/25" strokeWidth="1.5" />
      <path d="M15 4 A12 12 0 0 0 15 28 Z" className="fill-primary" />
      <path d="M17 4 A12 12 0 0 1 17 28 Z" className="fill-patina" />
    </svg>
  );
}

export function Wordmark({ className }: { readonly className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <CoinMark />
      <span className="font-display text-2xl leading-none tracking-tight">Janus</span>
    </span>
  );
}
