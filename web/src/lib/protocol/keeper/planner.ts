// Generated from keeper/src/lib/planner.ts by keeper/scripts/sync-artifacts.ts. Do not edit by hand.
import { inVoteWindow, voteEnd } from "./epochs";

/// Mirrors BoostMarket.Phase.
export const PHASE = { Idle: 0, Resetting: 1, Ready: 2, Voting: 3, Voted: 4 } as const;
export const PHASE_NAMES = ["Idle", "Resetting", "Ready", "Voting", "Voted"] as const;

export interface RoundView {
  readonly phase: number;
  readonly epoch: bigint;
  readonly startedAt: bigint;
}

export interface MarketSignals {
  /// Some vault shard has not voted in the current epoch.
  readonly hasEligibleShards: boolean;
  /// Some of those shards still carry votes from an earlier epoch. BoostVoter keeps votes
  /// across epochs, so leaving them would give last epoch's buyers boost they never paid for.
  readonly hasStaleVotes: boolean;
  /// Some active order would receive votes if a round settled now.
  readonly hasDemand: boolean;
  /// BoostMarket.ROUND_TIMEOUT in seconds.
  readonly roundTimeout: bigint;
}

/// Why the market rests, stable enough for a UI to map to its own copy.
export type WaitCode = "window-closed" | "sold-out" | "no-demand" | "unknown-phase";

export type Action =
  | { readonly kind: "startRound" }
  | { readonly kind: "resetShards" }
  | { readonly kind: "settle" }
  | { readonly kind: "castVotes" }
  | { readonly kind: "finalize"; readonly stale: boolean }
  | { readonly kind: "wait"; readonly code: WaitCode; readonly reason: string };

const wait = (code: WaitCode, reason: string): Action => ({ kind: "wait", code, reason });

/// Decides the next permissionless market call. Pure, so the keeper's policy is testable
/// without a chain: start a round when shards can vote and someone wants votes or old
/// votes need clearing, walk an open round forward, and close a stalled one once the
/// contract allows it.
export function nextAction(round: RoundView, now: bigint, signals: MarketSignals): Action {
  if (round.phase === PHASE.Idle) {
    if (!inVoteWindow(now)) return wait("window-closed", "outside the vote window");
    if (!signals.hasEligibleShards) return wait("sold-out", "every shard already voted this epoch");
    if (!signals.hasDemand && !signals.hasStaleVotes) {
      return wait("no-demand", "no order needs votes and no shard holds old votes");
    }
    return { kind: "startRound" };
  }
  if (round.phase === PHASE.Voted) return { kind: "finalize", stale: false };

  const stale = now > voteEnd(round.epoch) || now > round.startedAt + signals.roundTimeout;
  if (stale) return { kind: "finalize", stale: true };
  if (!inVoteWindow(now)) return wait("window-closed", "outside the vote window");

  switch (round.phase) {
    case PHASE.Resetting:
      return { kind: "resetShards" };
    case PHASE.Ready:
      return { kind: "settle" };
    case PHASE.Voting:
      return { kind: "castVotes" };
    default:
      return wait("unknown-phase", `unknown phase ${round.phase}`);
  }
}
