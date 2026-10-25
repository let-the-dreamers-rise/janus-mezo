"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowLeft, ArrowRight, KeyRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { useDemoWallet } from "@/hooks/use-demo-wallet";
import { browserStore } from "@/lib/demo/key-store";
import { INTRO_EVENT, INTRO_SLIDES, clampSlide, hasSeenIntro, markIntroSeen } from "@/lib/onboarding/intro";
import { cn } from "@/lib/utils";

const TONES = { bronze: "text-primary", patina: "text-patina", neutral: "text-muted-foreground" } as const;

function TryItActions({ onDone }: { readonly onDone: (then?: () => void) => void }) {
  const demo = useDemoWallet();
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
      {demo.active ? (
        <Button onClick={() => onDone(() => router.push("/start/"))}>
          Open my checklist <ArrowRight aria-hidden />
        </Button>
      ) : (
        <Button
          loading={demo.connecting}
          disabled={!demo.available}
          onClick={async () => {
            if (await demo.connect()) onDone(() => router.push("/start/"));
          }}
        >
          {demo.connecting ? null : <KeyRound aria-hidden />}
          Try with a demo wallet
        </Button>
      )}
      <Button variant="outline" onClick={() => onDone(openConnectModal)}>
        Connect my own wallet
      </Button>
    </div>
  );
}

/// The first-visit tour: five short slides with dots, Back, Next, Skip and arrow keys. It
/// opens once per browser on the home page and again whenever INTRO_EVENT fires.
export function IntroDialog() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const last = INTRO_SLIDES.length - 1;
  const slide = INTRO_SLIDES[index] ?? INTRO_SLIDES[0];

  useEffect(() => {
    const show = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(INTRO_EVENT, show);
    if (pathname === "/" && !hasSeenIntro(browserStore())) show();
    return () => window.removeEventListener(INTRO_EVENT, show);
  }, [pathname]);

  const change = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) markIntroSeen(browserStore());
  }, []);

  const finish = useCallback(
    (then?: () => void) => {
      change(false);
      then?.();
    },
    [change],
  );

  const go = (delta: number) => setIndex((current) => clampSlide(current + delta));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") go(1);
    if (event.key === "ArrowLeft") go(-1);
  };

  if (!slide) return null;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={change}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-popover p-6 text-popover-foreground shadow-xl focus-visible:outline-none sm:p-8"
        >
          <DialogPrimitive.Close
            aria-label="Close the tour"
            className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
          <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", TONES[slide.tone])}>
            {slide.eyebrow}
            <span className="sr-only">
              , slide {index + 1} of {INTRO_SLIDES.length}
            </span>
          </p>
          <DialogPrimitive.Title className="mt-3 pr-8 font-display text-3xl leading-tight md:text-4xl">
            {slide.title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-3 min-h-[4.5rem] text-base text-muted-foreground">
            {slide.body}
          </DialogPrimitive.Description>
          {index === last ? <TryItActions onDone={finish} /> : null}
          <div className="mt-8 flex items-center justify-between gap-4">
            <div className="flex items-center" role="group" aria-label="Tour slides">
              {INTRO_SLIDES.map((item, i) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Slide ${i + 1}: ${item.title}`}
                  aria-current={i === index ? "step" : undefined}
                  className="group inline-flex size-7 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "block size-2 rounded-full transition-colors",
                      i === index ? "bg-primary" : "bg-muted-foreground/30 group-hover:bg-muted-foreground/60",
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {index < last ? (
                <DialogPrimitive.Close asChild>
                  <Button variant="ghost">Skip</Button>
                </DialogPrimitive.Close>
              ) : (
                <DialogPrimitive.Close asChild>
                  <Button variant="ghost">Look around first</Button>
                </DialogPrimitive.Close>
              )}
              {index > 0 ? (
                <Button variant="outline" size="icon" aria-label="Previous slide" onClick={() => go(-1)}>
                  <ArrowLeft aria-hidden />
                </Button>
              ) : null}
              {index < last ? (
                <Button onClick={() => go(1)}>
                  Next <ArrowRight aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
