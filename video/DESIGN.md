# Janus demo film: design spec

Mode: autonomous free creation (video-shotcraft pipeline). Decisions below are the agent's,
recorded instead of confirmed.

## 0. Product brief

- **Product:** Janus, a boost market for Mezo. veBTC holders bid MUSD for the veMEZO votes that
  lift their Mezo Earn boost up to 5x; veMEZO holders pool locks in a vault (jMEZO) and keep 90%
  of every payment. Live on matsnet at https://janus-mezo.vercel.app.
- **Use:** Mezo Buildathon (AKINDO) Wave 1 submission video. Audience: judges and Mezo team, who
  know veBTC/veMEZO and score impact, execution and design.
- **Core claims (all verifiable):** 5x boost cap; manual bribing today; $1 of veMEZO decides the
  boost on about $75 of locked BTC (README, 2026-10-24 mainnet numbers); 90/10 split; pay only
  for delivered votes; round 1 on matsnet sold 100 votes, #1714 reached 5x; 125 contract tests;
  built on Mezo's own BoostVoter, veBTC, veMEZO.
- **Must show:** judge path (demo wallet + starter kit), bid form with quick picks and fill
  preview, the round result, Earn vault, the contracts, live URL.

### Requirement to execution

| Requirement | Effect on the film |
|---|---|
| 2-minute demo with narration (AKINDO) | 1920x1080, 30 fps, about 116 s; narration drives the timeline |
| User: energetic story voice, not neutral | edge-tts Andrew +8% rate; hook, pain, insight, demo, proof, close |
| User: pro zooms and transitions, not a slideshow | PageCam 2.5D camera over 2x captures, drawn cursor, eased push-ins, shot-transitions |
| Captions for muted viewing | word-timed captions from edge-tts WordBoundary |
| Data | testnet only; throwaway demo wallet; owner address already public in README |
| BGM | none chosen by user; agent picks a restrained bed from the skill library, delivered with and without BGM |

## 1. Visual direction

Styleframe skipped: the product has a strict brand spec (`brand.md`) and live pages, so the film
reuses them directly. Direction: **"one metal, two faces"**. Obsidian stage, bronze for the
Bitcoin side, patina for the MEZO side, the split coin as the recurring mark.

- Colors: background hsl(30 9% 5%), card hsl(30 8% 8%), foreground hsl(38 28% 90%), muted
  hsl(36 10% 64%), border hsl(30 7% 18%), bronze hsl(35 62% 58%), patina hsl(164 38% 56%).
- Type: Instrument Serif (titles, italic for the one emphasised word), Inter (captions, UI),
  JetBrains Mono tabular (numbers, ids).
- Light: one warm key light (bronze) and one cool rim (patina); no glow swarms.
- Motion personality: "professional trust" nudged toward "refined premium" (low energy,
  serious): main duration 24f, entrance bezier(0.22,1,0.36,1), overshoot 1.0 except physical
  landings (coin, wordmark slam: 1.04), no squash, camera ease bezier(0.33,0,0.15,1).
  Three words: calm, exact, weighty.

## 2. Feature to shot map

| Feature / beat | Card (style) | Why |
|---|---|---|
| Brand open (hook) | opening/brand-ink-open, bronze line instead of ink | low-energy wordmark open, hold 1 s |
| Manual weekly grind (problem) | rhythm/beat-step-list-theme-cycle (no music; paced to words) | a list that keeps cycling reads as "every week, again" |
| $1 vs $75 (insight) | data/odometer-digit-roll | one giant number lands the asymmetry |
| Two faces (janus) | transition/card-flip-reveal, two cards | bronze face and patina face flip to their promise |
| Judge path (start) | interaction/input-trigger-moves A cursor-performance + ui-entrance/row-embed | click, push-in, kit rows embed |
| Bid form (boost) | opening/spotlight-hero-card on the order form, then camera/cursor-flyover over the chips and preview | the hero of the product gets the one hero arc |
| Round result (market) | ui-entrance/list-stack-press (activity) + camera/crash-zoom-punch onto round #1 | stacking and one punch, used once each |
| Earn (patina face) | effects/light-play-moves B sheen on the earned MUSD | single quality light accent |
| Contracts (trust) | ui-entrance/wall-reveal-moves A bento light-up | four contract cards light in place |
| Close | outro/outro-group-photo-launch | elements from every shot gather round the wordmark |
| Seams | transition/shot-transitions | chosen per energy step |

## 3. Storyboard

Timeline is derived in code from `src/timings.json` (narration length per beat + 0.8 s breath),
so every shot starts with its line. Approx. times:

| # | Time | Shot | Key motion |
|---|---|---|---|
| 1 | 0-7 s | Brand open | bronze line draws the split coin, "Janus" stamps in, hook line; hold |
| 2 | 7-20 s | Problem | Post bribes / Chase voters / Poke boost / Every week cycle through a bronze capsule; 5x stays out of reach |
| 3 | 20-31 s | Insight | "$1" small, then $75 odometer rolls; captions "veMEZO" vs "locked BTC" |
| 4 | 31-42 s | Two faces | coin splits into two cards; bronze flips to "Buy boost, up to 5x", patina to "Sell votes, keep 90%" |
| 5 | 42-55 s | Judge path | /start/ page; cursor clicks "Try with a demo wallet"; push into the kit card; three rows embed as "In your wallet" |
| 6 | 55-73 s | Bid form | spotlight finds the order form; cursor taps 5x, "Top +10%", "Use 4 rounds"; push to the fill preview; Place bid; status card "Bidding" |
| 7 | 73-89 s | Market | order book and round history; activity rows stack; crash-zoom on round #1 (100 votes, paid out) |
| 8 | 89-98 s | Earn | whip to Earn; vault shards; sheen across MUSD earned |
| 9 | 98-108 s | Contracts | "Built on Mezo's own contracts" cards light up; "125 contract tests" |
| 10 | 108-116 s | Close | group photo round the wordmark, URL janus-mezo.vercel.app, hold 1.5 s |

Captions run on every shot except 1 and 10 (titles carry those).
