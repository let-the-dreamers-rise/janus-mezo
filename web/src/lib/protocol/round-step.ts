import { PHASE, PHASE_NAMES, nextAction, type MarketSignals, type RoundView, type WaitCode } from "./keeper/planner";

export { PHASE, PHASE_NAMES };
export type { MarketSignals, RoundView };

export type StepKind = "startRound" | "resetShards" | "settle" | "castVotes" | "finalize" | "applyBoosts";

export interface Step {
  readonly kind: StepKind | "wait";
  readonly label: string;
  readonly detail: string;
  /// Why the market waits, when it does.
  readonly code?: WaitCode;
}

export const phaseName = (phase: number): string => PHASE_NAMES[phase] ?? `Phase ${phase}`;

const WAITS: Record<WaitCode, Omit<Step, "kind">> = {
  "window-closed": {
    label: "Voting is closed",
    detail: "Mezo opens voting one hour into each epoch and closes it one hour before the end.",
  },
  "sold-out": {
    label: "Every shard has voted",
    detail: "This epoch's votes are sold. Shards vote again when the next epoch opens.",
  },
  "no-demand": {
    label: "Waiting for bids",
    detail: "No bid needs votes and no shard carries old votes.",
  },
  "unknown-phase": { label: "Unknown phase", detail: "The market reports a phase this app does not know." },
};

const boostsDetail = (count: number): string =>
  count === 1
    ? "1 buyer's boost is out of date. A poke applies what its votes earn now."
    : `${count} buyers' boosts are out of date. A poke applies what their votes earn now.`;

/// The permissionless call that moves the market forward now, chosen by the keeper's own
/// planner. When the market rests, out-of-date boosts are the remaining work.
export function nextStep(round: RoundView, now: bigint, signals: MarketSignals, staleBoosts: number): Step {
  const action = nextAction(round, now, signals);
  switch (action.kind) {
    case "startRound":
      return {
        kind: "startRound",
        label: "Start a round",
        detail: signals.hasDemand
          ? "Snapshots every shard that has not voted this epoch."
          : "Clears old votes, so nobody keeps boost they stopped paying for.",
      };
    case "resetShards":
      return { kind: "resetShards", label: "Reset shards", detail: "Clears old votes and records each shard's sellable power." };
    case "settle":
      return { kind: "settle", label: "Settle", detail: "Prices every bid and fills the highest first." };
    case "castVotes":
      return { kind: "castVotes", label: "Cast votes", detail: "Votes each shard's slice on the buyers' gauges." };
    case "finalize":
      return action.stale
        ? { kind: "finalize", label: "Close the stale round", detail: "Charges only the votes that landed." }
        : { kind: "finalize", label: "Finalize", detail: "Charges delivered votes and pays jMEZO holders." };
    case "wait":
      if (round.phase === PHASE.Idle && staleBoosts > 0) {
        return { kind: "applyBoosts", label: "Apply boosts", detail: boostsDetail(staleBoosts) };
      }
      return { kind: "wait", code: action.code, ...WAITS[action.code] };
  }
}
