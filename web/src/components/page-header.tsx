import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  bronze: "text-primary",
  patina: "text-patina",
  neutral: "text-muted-foreground",
} as const;

interface PageHeaderProps {
  readonly eyebrow?: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly tone?: keyof typeof TONES;
  readonly children?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, tone = "neutral", children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-6 border-b pb-8 pt-10 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl space-y-3">
        {eyebrow ? (
          <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", TONES[tone])}>{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">{title}</h1>
        {description ? <p className="text-base text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
