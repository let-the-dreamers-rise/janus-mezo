import { AlertCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly children?: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
}

export function EmptyState({ icon: Icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center", className)}>
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {children ? <div className="mx-auto max-w-sm text-sm text-muted-foreground">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  readonly title: string;
  readonly error: unknown;
  readonly onRetry?: () => void;
}

export function ErrorState({ title, error, onRetry }: ErrorStateProps) {
  const detail = error instanceof Error ? error.message : "This is usually a network hiccup.";
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="size-4" aria-hidden />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="line-clamp-3 text-sm text-muted-foreground">{detail}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
