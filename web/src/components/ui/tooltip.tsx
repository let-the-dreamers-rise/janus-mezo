"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

interface TipProps {
  readonly content: ReactNode;
  readonly children?: ReactNode;
  readonly label?: string;
  readonly className?: string;
}

/// A tooltip on a real button, so keyboard and touch users reach it too. Without children it
/// renders an info icon labelled `label`.
export function Tip({ content, children, label = "More information", className }: TipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label={label}
            className={cn(
              "-m-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            <Info className="size-3.5" aria-hidden />
          </button>
        )}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded-md border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
