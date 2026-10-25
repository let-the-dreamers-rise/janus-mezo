import { Address } from "@/components/address";
import { CoinMark } from "@/components/brand/logo";
import { IntroButton } from "@/components/onboarding/intro-button";
import { DEPLOYMENT, IS_DEPLOYED } from "@/config/deployment";
import { SITE } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="container grid gap-8 py-10 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CoinMark className="size-6" />
            <span className="font-display text-xl">Janus</span>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">{SITE.description}</p>
          <p className="text-xs text-muted-foreground">
            Testnet software on Mezo Matsnet. Contracts are unaudited.{" "}
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Source code
            </a>
          </p>
          <IntroButton variant="ghost" size="sm" className="-ml-3" />
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_auto]">
          {IS_DEPLOYED ? (
            <>
              <dt className="text-muted-foreground sm:py-1.5">JanusVault</dt>
              <dd>
                <Address address={DEPLOYMENT.vault} />
              </dd>
              <dt className="text-muted-foreground sm:py-1.5">BoostMarket</dt>
              <dd>
                <Address address={DEPLOYMENT.market} />
              </dd>
            </>
          ) : null}
          <dt className="text-muted-foreground sm:py-1.5">Mezo BoostVoter</dt>
          <dd>
            <Address address={DEPLOYMENT.boostVoter} />
          </dd>
        </dl>
      </div>
    </footer>
  );
}
