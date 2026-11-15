import type { RoundRow } from "./round-history";

const ONE = 10n ** 18n;

export interface RoundAnalytics {
  /// Rounds that closed and paid out.
  readonly rounds: number;
  readonly votesOffered: bigint;
  readonly votesSold: bigint;
  /// Share of offered votes that were sold, in percent. Null before any vote was offered.
  readonly fillRatePct: number | null;
  /// MUSD paid per vote sold, 18 decimals. Null before any vote was sold.
  readonly avgPricePerVote: bigint | null;
  readonly charged: bigint;
  readonly toHolders: bigint;
  /// MUSD earned by jMEZO holders per 100 votes offered, averaged per round.
  readonly holderIncomePer100Votes: bigint | null;
}

/// Totals across every finalized round. Rounds still in progress are left out.
export function roundAnalytics(rows: readonly RoundRow[]): RoundAnalytics {
  const done = rows.filter((row) => row.finalized);
  const sum = (pick: (row: RoundRow) => bigint | undefined) => done.reduce((total, row) => total + (pick(row) ?? 0n), 0n);
  const votesOffered = sum((row) => row.supply);
  const votesSold = sum((row) => row.filled);
  const charged = sum((row) => row.charged);
  const toHolders = sum((row) => row.toHolders);
  return {
    rounds: done.length,
    votesOffered,
    votesSold,
    fillRatePct: votesOffered > 0n ? Number((votesSold * 10_000n) / votesOffered) / 100 : null,
    avgPricePerVote: votesSold > 0n ? (charged * ONE) / votesSold : null,
    charged,
    toHolders,
    holderIncomePer100Votes: votesOffered > 0n ? (toHolders * 100n * ONE) / votesOffered : null,
  };
}
