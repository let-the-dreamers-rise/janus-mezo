const STEPS = [
  { call: "placeOrder", title: "Bid", body: "A veBTC holder escrows MUSD, names a price per 1,000 votes and a target boost." },
  { call: "startRound", title: "Snapshot", body: "The round picks every vault shard that has not voted this epoch." },
  { call: "resetShards", title: "Reset", body: "Last epoch's votes are cleared, so nobody keeps boost they stopped paying for." },
  { call: "settle", title: "Settle", body: "Each bid is priced with BoostVoter's own formula. The highest bids fill first." },
  { call: "castVotes", title: "Vote", body: "Shards vote their slice. Unsold power goes to the house gauge, never to a buyer for free." },
  { call: "finalize", title: "Charge and pay", body: "Buyers pay only for delivered votes: 90% to jMEZO holders, 10% to the treasury." },
  { call: "pokeBoost", title: "Apply boost", body: "A poke on BoostVoter writes each buyer's new boost into Mezo Earn." },
] as const;

export function RoundSteps() {
  return (
    <section aria-labelledby="round-title" className="border-y bg-card/50">
      <div className="container space-y-8 py-16">
        <div className="max-w-2xl space-y-3">
          <h2 id="round-title" className="font-display text-3xl md:text-4xl">
            How a round works
          </h2>
          <p className="text-muted-foreground">
            Every step is a permissionless call. The Janus keeper runs them inside Mezo&apos;s vote window, and so can
            anyone else, from the Market page.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.call} className="flex flex-col gap-2 rounded-lg border bg-background p-4">
              <span className="num text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              <p className="font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
              <code className="num mt-auto text-xs text-primary">{step.call}</code>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
