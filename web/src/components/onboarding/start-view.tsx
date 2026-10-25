"use client";

import { Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useJanusAccount } from "@/hooks/use-janus-account";
import { useMounted } from "@/hooks/use-mounted";
import { checklist, nextStep, type ChecklistId, type ChecklistStep } from "@/lib/onboarding/checklist";
import { cn } from "@/lib/utils";
import { DemoWalletButton } from "./demo-wallet-button";
import { DemoWalletNote } from "./demo-wallet-note";
import { IntroButton } from "./intro-button";
import { StarterKitCard } from "./starter-kit-card";

const ACTION_LABELS: Readonly<Record<ChecklistId, string>> = {
  wallet: "Connect",
  kit: "Get the kit",
  gauge: "Open Boost",
  bid: "Open Boost",
  deposit: "Open Earn",
  round: "Open Market",
  boost: "Open Boost",
  claim: "Open Earn",
};

function StepAction({ step, current }: { readonly step: ChecklistStep; readonly current: boolean }) {
  if (step.done) return null;
  if (step.id === "wallet") {
    return (
      <div className="flex flex-wrap gap-2">
        <DemoWalletButton variant="default" />
        <WalletButton />
      </div>
    );
  }
  if (!step.href) return null;
  return (
    <ButtonLink href={step.href} size="sm" variant={current ? "default" : "outline"}>
      {ACTION_LABELS[step.id]}
    </ButtonLink>
  );
}

function StepRow({ step, index, current }: { readonly step: ChecklistStep; readonly index: number; readonly current: boolean }) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center",
        current && "border-primary/50 ring-1 ring-primary/30",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "num mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
            step.done ? "border-patina bg-patina text-patina-foreground" : "text-muted-foreground",
          )}
          aria-hidden
        >
          {step.done ? <Check className="size-4" /> : index + 1}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="sr-only">{step.done ? "Done: " : "To do: "}</span>
            {step.title}
            {current ? <Badge tone="bronze">Next</Badge> : null}
          </p>
          <p className="text-sm text-muted-foreground">{step.detail}</p>
        </div>
      </div>
      <div className="shrink-0 sm:pl-4">
        <StepAction step={step} current={current} />
      </div>
    </li>
  );
}

/// The getting-started page: a checklist ticked from chain data next to the starter kit.
export function StartView() {
  const account = useJanusAccount();
  const mounted = useMounted();
  const connected = mounted && account.isConnected && !account.readOnly;
  const steps = checklist({ connected, account: account.data });
  const next = nextStep(steps);
  const done = steps.filter((step) => step.done).length;
  const reading = connected && account.isPending;
  return (
    <div className="container space-y-8 pb-16">
      <PageHeader
        eyebrow="Get started"
        tone="bronze"
        title={
          <>
            Try Janus in <em className="text-primary">five minutes</em>
          </>
        }
        description="A demo wallet and a free starter kit let you play both sides on Mezo Matsnet: bid for a veBTC boost, earn from a veMEZO lock, and run a round yourself."
      >
        <IntroButton />
      </PageHeader>
      <DemoWalletNote />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="checklist-title" className="space-y-4" aria-busy={reading || undefined}>
          <div className="flex items-end justify-between gap-4">
            <h2 id="checklist-title" className="text-lg font-semibold">
              Your checklist
            </h2>
            <p className="text-sm text-muted-foreground">
              {reading ? (
                "Reading your wallet..."
              ) : (
                <>
                  <span className="num">{done}</span> of {steps.length} done
                </>
              )}
            </p>
          </div>
          <Progress value={done / steps.length} label="Checklist progress" />
          {account.isError ? (
            <ErrorState title="Could not read your wallet" error={account.error} onRetry={() => void account.refetch()} />
          ) : null}
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <StepRow key={step.id} step={step} index={index} current={!reading && step.id === next?.id} />
            ))}
          </ol>
          {next === undefined ? (
            <p className="rounded-lg border border-patina/40 bg-patina/10 p-4 text-sm">
              Every step is done: you have played both faces of Janus. Rounds keep running each epoch, so your boost
              and your MUSD keep coming.
            </p>
          ) : null}
        </section>
        <aside id="starter-kit" className="scroll-mt-24 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <StarterKitCard />
        </aside>
      </div>
    </div>
  );
}
