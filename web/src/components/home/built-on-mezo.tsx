import { ExternalLink } from "lucide-react";
import { explorerUrl } from "@/lib/explorer";
import { DEPLOYMENT } from "@/config/deployment";

const PIECES = [
  { name: "BoostVoter", role: "Gauges, votes and the 5x boost formula Janus prices with.", address: DEPLOYMENT.boostVoter },
  { name: "veMEZO", role: "The locks the vault holds as vote shards, made permanent on deposit.", address: DEPLOYMENT.veMezo },
  { name: "veBTC", role: "The NFTs whose Earn boost buyers raise.", address: DEPLOYMENT.veBtc },
  { name: "MUSD", role: "Every bid, charge and payout is in Mezo's stablecoin.", address: DEPLOYMENT.musd },
] as const;

export function BuiltOnMezo() {
  return (
    <section aria-labelledby="mezo-title" className="container grid gap-8 py-16 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-3">
        <h2 id="mezo-title" className="font-display text-3xl md:text-4xl">
          Built on Mezo&apos;s own contracts
        </h2>
        <p className="text-muted-foreground">
          Janus adds a vault and a market, nothing else. Votes, boosts and gauges stay in Mezo&apos;s contracts, and
          Bitcoin wallets sign through Mezo Passport.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PIECES.map((piece) => (
          <li key={piece.name}>
            <a
              href={explorerUrl("address", piece.address)}
              target="_blank"
              rel="noreferrer"
              className="flex h-full flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-2 font-medium">
                {piece.name}
                <ExternalLink className="size-3.5 text-muted-foreground" aria-label="opens the Mezo explorer" />
              </span>
              <span className="text-sm text-muted-foreground">{piece.role}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
