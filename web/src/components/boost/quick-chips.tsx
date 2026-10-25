"use client";

import { cn } from "@/lib/utils";

export interface Chip {
  readonly label: string;
  readonly active: boolean;
  readonly onPick: () => void;
}

/// A row of one-click presets for a form field.
export function QuickChips({ label, chips }: { readonly label: string; readonly chips: readonly Chip[] }) {
  if (chips.length === 0) return null;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          aria-pressed={chip.active}
          onClick={chip.onPick}
          className={cn(
            "min-h-8 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            chip.active
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
