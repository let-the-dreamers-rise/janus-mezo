import { formatUnits } from "viem";
import { ceilDiv } from "./boost-math";

/// One veMEZO vote, as BoostMarket counts them (VOTE_UNIT).
export const VOTE_UNIT = 10n ** 18n;
export const TOKEN_DECIMALS = 18;
/// Bids are shown and typed per 1,000 votes; the contract stores MUSD-wei per vote.
export const QUOTE_VOTES = 1_000n;

/// Strict parser for amounts people type: digits with at most one dot and no more
/// fraction digits than the token has. Returns null for anything else.
export function parseDecimal(input: string, decimals: number = TOKEN_DECIMALS): bigint | null {
  const text = input.trim();
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(text)) return null;
  const [whole = "", fraction = ""] = text.split(".");
  if (fraction.length > decimals) return null;
  return BigInt(`${whole === "" ? "0" : whole}${fraction.padEnd(decimals, "0")}`);
}

export const pricePerVoteFromQuote = (quote: bigint): bigint => quote / QUOTE_VOTES;
export const quoteFromPricePerVote = (pricePerVote: bigint): bigint => pricePerVote * QUOTE_VOTES;

/// What BoostMarket charges for `votes` delivered at `pricePerVote`, rounded up as
/// Math.mulDiv(votes, price, VOTE_UNIT, Ceil) does.
export const costOfVotes = (votes: bigint, pricePerVote: bigint): bigint => ceilDiv(votes * pricePerVote, VOTE_UNIT);

/// Votes an escrow can pay for, as BoostMarket._fillFor computes it.
export const affordableVotes = (escrow: bigint, pricePerVote: bigint): bigint =>
  pricePerVote === 0n ? 0n : (escrow * VOTE_UNIT) / pricePerVote;

export const toNumber = (value: bigint, decimals: number = TOKEN_DECIMALS): number =>
  Number(formatUnits(value, decimals));

export const toRaw = (value: bigint, decimals: number = TOKEN_DECIMALS): string => formatUnits(value, decimals);
