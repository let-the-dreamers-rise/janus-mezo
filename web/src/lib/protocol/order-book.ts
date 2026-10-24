import type { Address } from "viem";
import { additionalVotes, boostOf } from "./boost-math";
import { affordableVotes, costOfVotes } from "./units";

/// A standing bid plus the chain state BoostMarket._fillFor reads for it.
export interface BookEntry {
  readonly orderId: bigint;
  readonly owner: Address;
  readonly tokenId: bigint;
  readonly pricePerVote: bigint;
  readonly targetBoost: bigint;
  readonly escrow: bigint;
  /// veBTC.ownerOf(tokenId); undefined when the read failed (burned NFT).
  readonly nftOwner: Address | undefined;
  /// Boost gauge of the NFT; undefined when it has none.
  readonly gauge: Address | undefined;
  readonly gaugeAlive: boolean;
  /// veBTC.unboostedVotingPowerOfNFT(tokenId).
  readonly boostable: bigint;
  /// BoostVoter.weights(gauge).
  readonly gaugeWeight: bigint;
}

export interface MarketTotals {
  /// veMEZO.totalVotingPower()
  readonly votingTotal: bigint;
  /// veBTC.unboostedTotalVotingPower()
  readonly boostableTotal: bigint;
}

export type FillStatus = "full" | "partial" | "unfilled" | "at-target" | "ineligible";

export interface Projection {
  readonly entry: BookEntry;
  /// 1-based priority: highest price first, then the oldest order.
  readonly rank: number;
  readonly need: bigint;
  readonly votes: bigint;
  readonly cost: bigint;
  readonly status: FillStatus;
  readonly reason: string | undefined;
  readonly boostAfter: bigint;
}

/// BoostMarket priority (OrderSort): price descending, then order id ascending.
export function compareBids(a: BookEntry, b: BookEntry): number {
  if (a.pricePerVote !== b.pricePerVote) return a.pricePerVote > b.pricePerVote ? -1 : 1;
  if (a.orderId === b.orderId) return 0;
  return a.orderId < b.orderId ? -1 : 1;
}

const sameAddress = (a: Address | undefined, b: Address) => a !== undefined && a.toLowerCase() === b.toLowerCase();

function ineligibility(entry: BookEntry, totals: MarketTotals, minPricePerVote: bigint): string | undefined {
  if (entry.pricePerVote < minPricePerVote) return "Bid is below the market minimum";
  if (!sameAddress(entry.nftOwner, entry.owner)) return "The veBTC NFT changed hands";
  if (!entry.gauge || !entry.gaugeAlive) return "The boost gauge is missing or killed";
  if (entry.boostable === 0n) return "The veBTC lock has no voting power left";
  if (totals.boostableTotal * 10n ** 18n < entry.boostable) return "The veBTC NFT cannot be priced";
  return undefined;
}

/// The keeper's demand test: some eligible bid is below its target and its escrow can pay
/// for votes, so a round started now would sell something if supply allowed.
export function hasDemand(projections: readonly Projection[]): boolean {
  return projections.some((p) => p.need > 0n && affordableVotes(p.entry.escrow, p.entry.pricePerVote) > 0n);
}

/// What BoostMarket.settle would allocate if a round with `supply` votes settled now:
/// highest bids first, each capped by its need, its escrow and the votes left.
export function projectFills(
  entries: readonly BookEntry[],
  supply: bigint,
  totals: MarketTotals,
  minPricePerVote: bigint,
): Projection[] {
  const priced = totals.votingTotal > 0n && totals.boostableTotal > 0n;
  let remaining = supply;
  return [...entries].sort(compareBids).map((entry, index) => {
    const base = { entry, rank: index + 1 };
    const blocked = ineligibility(entry, totals, minPricePerVote);
    const need = priced && !blocked
      ? additionalVotes(totals.votingTotal, totals.boostableTotal, entry.boostable, entry.targetBoost, entry.gaugeWeight)
      : null;
    const current = boostOf(totals.votingTotal, totals.boostableTotal, entry.boostable, entry.gaugeWeight);
    if (blocked || need === null) {
      const reason = blocked ?? "The market has no veMEZO or veBTC supply to price against";
      return { ...base, need: 0n, votes: 0n, cost: 0n, status: "ineligible", reason, boostAfter: current };
    }
    if (need === 0n) {
      return { ...base, need, votes: 0n, cost: 0n, status: "at-target", reason: "Already at its target boost", boostAfter: current };
    }
    const affordable = affordableVotes(entry.escrow, entry.pricePerVote);
    const votes = [need, remaining, affordable].reduce((a, b) => (a < b ? a : b));
    remaining -= votes;
    const boostAfter = boostOf(totals.votingTotal, totals.boostableTotal, entry.boostable, entry.gaugeWeight + votes);
    const cost = [costOfVotes(votes, entry.pricePerVote), entry.escrow].reduce((a, b) => (a < b ? a : b));
    if (votes === need) return { ...base, need, votes, cost, status: "full", reason: undefined, boostAfter };
    if (votes === 0n) {
      const reason = affordable === 0n ? "Escrow is used up" : "No votes left at this price";
      return { ...base, need, votes, cost, status: "unfilled", reason, boostAfter };
    }
    const reason = votes === affordable ? "Limited by escrow" : "Limited by votes for sale";
    return { ...base, need, votes, cost, status: "partial", reason, boostAfter };
  });
}
