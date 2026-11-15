import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MILESTONES } from "./milestones";

export function Planned() {
  return (
    <section aria-labelledby="roadmap-title" className="container space-y-6 py-16">
      <div className="max-w-2xl space-y-3">
        <h2 id="roadmap-title" className="font-display text-3xl md:text-4xl">
          Roadmap
        </h2>
        <p className="text-muted-foreground">
          What has shipped, and what comes next. Janus is being built as a product beyond the buildathon.
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MILESTONES.map((item) => {
          const shipped = item.status === "shipped";
          return (
            <li
              key={item.name}
              className={cn("flex flex-col gap-1 rounded-lg border bg-card p-4", shipped ? "border-patina/40" : "border-dashed")}
            >
              <span className={cn("num flex items-center gap-1.5 text-xs", shipped ? "text-patina" : "text-primary")}>
                {shipped ? <Check className="size-3.5" aria-hidden /> : null}
                {shipped ? `Shipped · ${item.when}` : item.when}
              </span>
              <span className="font-medium">{item.name}</span>
              <span className="text-sm text-muted-foreground">{item.detail}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
