import type { KeyStore } from "@/lib/demo/key-store";

export const INTRO_SEEN_ITEM = "janus.intro.seen.v1";
/// Dispatched on window to open the intro again from anywhere.
export const INTRO_EVENT = "janus:open-intro";

export interface IntroSlide {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly tone: "bronze" | "patina" | "neutral";
}

export const INTRO_SLIDES: readonly IntroSlide[] = [
  {
    eyebrow: "Janus",
    title: "Mezo Earn boost, as a market",
    body: "Mezo pays a veBTC NFT up to 5x more when veMEZO votes go to its gauge. Janus lets the two sides trade those votes for MUSD.",
    tone: "neutral",
  },
  {
    eyebrow: "Bronze face",
    title: "Bid for boost",
    body: "veBTC holders bid MUSD per 1,000 votes and pick a target boost. The best bids fill first, and you pay only for votes that land on your gauge.",
    tone: "bronze",
  },
  {
    eyebrow: "Patina face",
    title: "Pool veMEZO, earn MUSD",
    body: "veMEZO holders deposit locks into one vault and get jMEZO 1:1. Every epoch the vault sells its votes, and jMEZO holders take 90% of the MUSD.",
    tone: "patina",
  },
  {
    eyebrow: "Rounds",
    title: "One round per epoch, run by anyone",
    body: "Start, reset, settle, cast votes, finalize. Every step is a public call, so a keeper or any visitor can move the market along.",
    tone: "neutral",
  },
  {
    eyebrow: "Try it",
    title: "Play both sides in five minutes",
    body: "A demo wallet and a free starter kit cover gas, MUSD, a veBTC NFT and a veMEZO NFT. Or connect a wallet you already use.",
    tone: "neutral",
  },
];

export const clampSlide = (index: number, total: number = INTRO_SLIDES.length): number =>
  Math.min(Math.max(index, 0), total - 1);

/// True when the intro was dismissed in this browser, and also when storage is unavailable:
/// a browser that cannot remember the dismissal should not see the intro on every visit.
export function hasSeenIntro(store: KeyStore | undefined): boolean {
  if (!store) return true;
  try {
    return store.getItem(INTRO_SEEN_ITEM) === "1";
  } catch {
    return true;
  }
}

export function markIntroSeen(store: KeyStore | undefined): void {
  try {
    store?.setItem(INTRO_SEEN_ITEM, "1");
  } catch {
    // Nothing to remember it in; hasSeenIntro already treats this browser as having seen it.
  }
}
