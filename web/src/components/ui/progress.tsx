import { cn } from "@/lib/utils";

interface ProgressProps {
  /// 0 to 1.
  readonly value: number;
  readonly label: string;
  readonly tone?: "bronze" | "patina";
  readonly className?: string;
}

export function Progress({ value, label, tone = "bronze", className }: ProgressProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tone === "bronze" ? "bg-primary" : "bg-patina")}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
