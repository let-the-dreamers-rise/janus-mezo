import { projectFills, type BookEntry, type MarketTotals, type Projection } from "./order-book";
import { costOfVotes, parseDecimal, pricePerVoteFromQuote, quoteFromPricePerVote, toRaw } from "./units";

/// The target boost slider works in hundredths: 1.25x to 5x in steps of 0.25x.
export const TARGET_MIN = 125;
export const TARGET_MAX = 500;
export const TARGET_STEP = 25;
export const targetFromHundredths = (hundredths: number): bigint => BigInt(hundredths) * 10n ** 16n;
export const hundredthsFromTarget = (target: bigint): number => Number(target / 10n ** 16n);

export type Checked<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

/// A bid as typed, in MUSD per 1,000 votes, checked and turned into MUSD-wei per vote.
export function checkQuote(input: string, minPricePerVote: bigint): Checked<bigint> {
  const quote = parseDecimal(input);
  if (quote === null || quote === 0n) return { ok: false, message: "Enter a bid in MUSD per 1,000 votes." };
  const pricePerVote = pricePerVoteFromQuote(quote);
  if (pricePerVote < minPricePerVote) {
    return { ok: false, message: `Bids start at ${toRaw(quoteFromPricePerVote(minPricePerVote))} MUSD per 1,000 votes.` };
  }
  return { ok: true, value: pricePerVote };
}

/// An MUSD amount as typed. `available` undefined skips the balance check.
export function checkAmount(input: string, available: bigint | undefined): Checked<bigint> {
  const amount = parseDecimal(input);
  if (amount === null || amount === 0n) return { ok: false, message: "Enter an amount of MUSD." };
  if (available !== undefined && amount > available) {
    return { ok: false, message: "That is more MUSD than this account holds." };
  }
  return { ok: true, value: amount };
}

/// Rounds an escrow pays for when every round needs the full `need`.
export function roundsCovered(escrow: bigint, need: bigint | null, pricePerVote: bigint): bigint | null {
  if (need === null || need === 0n) return null;
  const perRound = costOfVotes(need, pricePerVote);
  return perRound === 0n ? null : escrow / perRound;
}

export function suggestedEscrow(need: bigint | null, pricePerVote: bigint, rounds: bigint): bigint | null {
  if (need === null || need === 0n) return null;
  return costOfVotes(need, pricePerVote) * rounds;
}

/// Where `mine` would land if a round settled with `supply` votes. An entry with the same
/// order id is replaced, so the same call previews a new bid and a changed one.
export function previewBid(
  book: readonly BookEntry[],
  mine: BookEntry,
  supply: bigint,
  totals: MarketTotals,
  minPricePerVote: bigint,
): Projection | undefined {
  const others = book.filter((entry) => entry.orderId !== mine.orderId);
  return projectFills([...others, mine], supply, totals, minPricePerVote).find(
    (projection) => projection.entry.orderId === mine.orderId,
  );
}

/// Sentences joined with a period after each, so a projection's bare reason reads as one.
const sentences = (...parts: readonly (string | undefined)[]): string =>
  parts
    .filter((part): part is string => part !== undefined && part !== "")
    .map((part) => (part.endsWith(".") ? part : `${part}.`))
    .join(" ");

/// Plain sentences for a projected fill.
export function describeFill(projection: Projection | undefined): string {
  if (!projection) return "Not priced yet.";
  switch (projection.status) {
    case "full":
      return sentences(`Fills in full at rank ${projection.rank}`);
    case "partial":
      return sentences(`Fills in part at rank ${projection.rank}`, projection.reason);
    case "unfilled":
      return sentences("Would not fill", projection.reason);
    case "at-target":
      return "Already at its target boost, so it buys nothing.";
    case "ineligible":
      return sentences("Skipped", projection.reason);
  }
}
