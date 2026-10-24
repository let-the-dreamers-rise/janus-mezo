import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FaceProps {
  readonly tone: "bronze" | "patina";
  readonly eyebrow: string;
  readonly title: string;
  readonly points: readonly string[];
  readonly href: string;
  readonly cta: string;
}

function Face({ tone, eyebrow, title, points, href, cta }: FaceProps) {
  const accent = tone === "bronze" ? "text-primary" : "text-patina";
  return (
    <article className={cn("flex flex-col gap-5 rounded-2xl border bg-card p-6 md:p-8", tone === "bronze" ? "border-primary/25" : "border-patina/25")}>
      <div className="space-y-2">
        <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", accent)}>{eyebrow}</p>
        <h3 className="font-display text-3xl leading-tight">{title}</h3>
      </div>
      <ul className="flex-1 space-y-3">
        {points.map((point) => (
          <li key={point} className="flex gap-3 text-sm">
            <Check className={cn("mt-0.5 size-4 shrink-0", accent)} aria-hidden />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <ButtonLink href={href} variant={tone === "bronze" ? "default" : "patina"} className="self-start">
        {cta}
      </ButtonLink>
    </article>
  );
}

export function TwoFaces() {
  return (
    <section aria-labelledby="faces-title" className="container space-y-6 py-16">
      <h2 id="faces-title" className="font-display text-3xl md:text-4xl">
        One market, two faces
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        <Face
          tone="bronze"
          eyebrow="For veBTC holders"
          title="Buy boost instead of chasing votes"
          points={[
            "Bid in MUSD per 1,000 votes and pick a target boost up to 5x.",
            "Pay only for votes that land on your gauge. Unspent escrow stays yours.",
            "The highest bids fill first, and every price is public on the order book.",
            "Cancel between rounds and the remaining escrow comes straight back.",
          ]}
          href="/boost/"
          cta="Boost my veBTC"
        />
        <Face
          tone="patina"
          eyebrow="For veMEZO holders"
          title="Sell your votes every epoch"
          points={[
            "Deposit a veMEZO NFT and receive jMEZO 1:1. Depositing makes the lock permanent.",
            "Each round sells the vault's votes to the highest veBTC bids.",
            "jMEZO holders earn 90% of every payment, claimable in MUSD at any time.",
            "Burn jMEZO equal to a shard's amount to take that veMEZO NFT back.",
          ]}
          href="/earn/"
          cta="Put my veMEZO to work"
        />
      </div>
    </section>
  );
}
