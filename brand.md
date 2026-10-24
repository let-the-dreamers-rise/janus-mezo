# Brand - Janus

_Status: active. Chosen during the Wave 1 build; run `/brand-design` to replace it._

## Idea

Janus is the Roman god of doorways, shown with two faces looking opposite ways. The first
Roman bronze coin, the as, carried his double head. The product has the same two faces:
veBTC holders who buy boost, and veMEZO holders who sell votes. One metal, two faces:

- **Bronze** is the Bitcoin face: buyers, bids, boost. Warm, polished.
- **Patina** (verdigris, the green that grows on old bronze) is the MEZO face: the vault,
  jMEZO, payouts. Cool, earned over time.

The mark is a split coin: a rim with a bronze half and a patina half.

## Palette

Tokens are HSL triplets in `web/src/app/globals.css`. Every text pairing below passes
WCAG AA (checked with a contrast script; lowest pair is 4.57:1).

| Token | Dark (default look) | Light |
|---|---|---|
| background | 30 9% 5% obsidian | 40 33% 96% parchment |
| card | 30 8% 8% | 40 40% 99% |
| muted | 30 7% 14% | 38 25% 91% |
| foreground | 38 28% 90% | 30 12% 10% |
| muted-foreground | 36 10% 64% | 30 8% 36% |
| border | 30 7% 18% | 36 20% 84% |
| primary (bronze) | 35 62% 58% | 32 65% 34% |
| patina | 164 38% 56% | 166 45% 27% |
| destructive | 5 70% 60% | 4 65% 44% |
| warning | 42 85% 62% | 36 90% 34% |

Bronze and patina carry meaning (which side of the market), so they are the only accents.
Red is for destructive actions and errors only. Grays are warm; never mix in cool grays.

## Typography

- Display: Instrument Serif, for page titles and the hero. Italic for the one emphasised word.
- UI: Inter.
- Numbers, ids and addresses: JetBrains Mono with tabular numerals.

## Voice

Plain, concrete and brief. Say what happens to the user's assets in the sentence that asks
them to act: "Depositing makes this lock permanent." Name units every time (MUSD, votes,
veBTC NFT #1710). No hype words, no emoji.
