const PLANNED = [
  { name: "Boost forwards", detail: "Buy a target boost for several epochs at a quoted price, instead of bidding round by round." },
  { name: "veBTC autopilot", detail: "Re-lock, claim and keep the boost applied without manual steps." },
  { name: "jMEZO/MUSD pool", detail: "A pool for the vault share, with its own gauge so jMEZO trades without unlocking." },
  { name: "Credit gauges", detail: "jMEZO votes that direct MUSD liquidity to lending markets, with voters as first loss." },
] as const;

export function Planned() {
  return (
    <section aria-labelledby="planned-title" className="container space-y-6 py-16">
      <div className="max-w-2xl space-y-3">
        <h2 id="planned-title" className="font-display text-3xl md:text-4xl">
          Planned
        </h2>
        <p className="text-muted-foreground">Not built yet. These are next, in roughly this order.</p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANNED.map((item, index) => (
          <li key={item.name} className="flex flex-col gap-1 rounded-lg border border-dashed bg-card p-4">
            <span className="num text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
            <span className="font-medium">{item.name}</span>
            <span className="text-sm text-muted-foreground">{item.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
