import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly hint?: ReactNode;
  readonly loading?: boolean;
  readonly className?: string;
}

export function Stat({ label, value, hint, loading = false, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-lg border bg-card p-4", className)}>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {loading ? <Skeleton className="h-7 w-24" /> : <span className="text-lg font-semibold leading-tight sm:text-xl">{value}</span>}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
