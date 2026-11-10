import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { PROOF_ITEMS, proofHref, statusCounts, type ProofItem, type ProofStatus } from "@/lib/proof/evidence";

const STATUS: Record<ProofStatus, { readonly label: string; readonly tone: "patina" | "bronze" | "warning" | "neutral" }> = {
  proven: { label: "Proven", tone: "patina" },
  built: { label: "Built, not yet live", tone: "bronze" },
  partial: { label: "Partly done", tone: "warning" },
  open: { label: "Not done", tone: "neutral" },
};

const LIMITS = [
  "Janus has had no third-party bidders or depositors. Every on-chain position so far is ours.",
  "Everything here runs on Matsnet testnet.",
  "The contracts are unaudited. An internal, AI-assisted review found no critical or high issues, and its four medium findings are fixed.",
  "One wallet owns both contracts. It can change settings but cannot move the vault's shards.",
];

function ProofRow({ item }: { readonly item: ProofItem }) {
  const status = STATUS[item.status];
  return (
    <li className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{item.ask}</h3>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="text-sm">{item.summary}</p>
      {item.limit ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Limit: </span>
          {item.limit}
        </p>
      ) : null}
      {item.links.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4">
          {item.links.map((link) => (
            <li key={link.label}>
              <a
                href={proofHref(link)}
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
      ) : null}
    </li>
  );
}

export function ProofView() {
  const counts = statusCounts(PROOF_ITEMS);
  return (
    <div className="container space-y-10 pb-16">
      <PageHeader
        eyebrow="Evidence"
        title="What is proven, and what is not"
        description={`Each point of the Wave 1 judge feedback, with a link you can check. ${counts.proven} proven, ${counts.built} built but not yet live, ${counts.partial} partly done, ${counts.open} not done.`}
      />
      <section aria-labelledby="limits-title" className="space-y-3 rounded-lg border border-warning/30 bg-warning/10 p-5">
        <h2 id="limits-title" className="font-semibold">
          Read this first
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="feedback-title" className="space-y-3">
        <h2 id="feedback-title" className="text-lg font-semibold">
          Judge feedback, point by point
        </h2>
        <ol className="divide-y rounded-lg border bg-card">
          {PROOF_ITEMS.map((item) => (
            <ProofRow key={item.id} item={item} />
          ))}
        </ol>
      </section>
    </div>
  );
}
