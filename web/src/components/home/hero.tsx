import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CoinMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

function TwoFacesCoin() {
  return (
    <figure className="mx-auto flex w-full max-w-md flex-col items-center gap-8 rounded-2xl border bg-card p-8">
      <CoinMark className="size-36 md:size-44" />
      <figcaption className="grid w-full grid-cols-2 gap-4 text-sm">
        <div className="space-y-1 border-r pr-4">
          <p className="font-medium text-primary">Bronze face</p>
          <p className="text-muted-foreground">veBTC holders bid MUSD for boost.</p>
        </div>
        <div className="space-y-1">
          <p className="font-medium text-patina">Patina face</p>
          <p className="text-muted-foreground">veMEZO holders sell their votes and earn.</p>
        </div>
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <section className="container grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.25fr_1fr]">
      <div className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mezo Earn boost, as a market</p>
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
          Boost, <em className="text-primary">priced</em> in MUSD.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          veBTC holders bid MUSD for the veMEZO votes that lift their Earn boost up to 5x. veMEZO holders pool
          their locks in one vault and take 90% of every sale.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/boost/" size="lg">
            Boost my veBTC <ArrowRight aria-hidden />
          </ButtonLink>
          <ButtonLink href="/earn/" size="lg" variant="patina">
            Put my veMEZO to work
          </ButtonLink>
        </div>
        <p className="text-sm text-muted-foreground">
          Live on Mezo Matsnet.{" "}
          <Link
            href="/start/"
            className="rounded-sm font-medium text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            New here? Try both sides with a demo wallet and a free starter kit.
          </Link>
        </p>
      </div>
      <TwoFacesCoin />
    </section>
  );
}
