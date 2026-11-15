import { CheckCircle2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SECTIONS, factHref, type Fact } from "@/lib/transparency/facts";

function FactCard({ fact }: { readonly fact: Fact }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-5">
      <h3 className="flex items-start gap-2 font-medium">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-patina" aria-hidden />
        {fact.title}
      </h3>
      <p className="text-sm text-muted-foreground">{fact.detail}</p>
      <ul className="mt-auto flex flex-wrap gap-x-4">
        {fact.links.map((link) => (
          <li key={link.label}>
            <a
              href={factHref(link)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-1 rounded-sm text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function TransparencyView() {
  return (
    <div className="container space-y-12 pb-16">
      <PageHeader
        eyebrow="Transparency"
        title="Everything Janus has shipped, on chain"
        description="Every item links to a transaction, a contract or the source, so you can check it yourself."
      />
      {SECTIONS.map((section) => (
        <section key={section.id} aria-labelledby={`${section.id}-title`} className="space-y-4">
          <h2 id={`${section.id}-title`} className="font-display text-2xl md:text-3xl">
            {section.title}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {section.facts.map((fact) => (
              <FactCard key={fact.title} fact={fact} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
