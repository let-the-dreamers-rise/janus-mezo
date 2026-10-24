import { describe, expect, it } from "vitest";
import { PHASE, nextStep, phaseName, type MarketSignals, type RoundView } from "./round-step";

const EPOCH = 1_792_627_200n;
const HOUR = 3_600n;
const DAY = 24n * HOUR;
const TIMEOUT = 12n * HOUR;
const inWindow = EPOCH + DAY;
const idle: RoundView = { phase: PHASE.Idle, epoch: 0n, startedAt: 0n };
const open = (phase: number, startedAt = inWindow): RoundView => ({ phase, epoch: EPOCH, startedAt });
const signals: MarketSignals = { hasEligibleShards: true, hasStaleVotes: false, hasDemand: true, roundTimeout: TIMEOUT };
const quiet: MarketSignals = { ...signals, hasDemand: false };

describe("nextStep", () => {
  it("starts a round when shards can vote and a bid needs votes", () => {
    expect(nextStep(idle, inWindow, signals, 0)).toMatchObject({ kind: "startRound", label: "Start a round" });
  });

  it("starts a clearing round when old votes remain and nobody bids", () => {
    const step = nextStep(idle, inWindow, { ...quiet, hasStaleVotes: true }, 0);
    expect(step.kind).toBe("startRound");
    expect(step.detail).toMatch(/old votes/);
  });

  it("explains each reason to wait", () => {
    expect(nextStep(idle, inWindow, quiet, 0).label).toBe("Waiting for bids");
    expect(nextStep(idle, inWindow, { ...signals, hasEligibleShards: false }, 0).label).toBe("Every shard has voted");
    expect(nextStep(idle, EPOCH + HOUR, signals, 0).label).toBe("Voting is closed");
  });

  it("names the reason to wait with the keeper's code", () => {
    expect(nextStep(idle, inWindow, { ...signals, hasEligibleShards: false }, 0).code).toBe("sold-out");
    expect(nextStep(idle, inWindow, quiet, 0).code).toBe("no-demand");
    expect(nextStep(idle, inWindow, signals, 0).code).toBeUndefined();
  });

  it("walks an open round through its phases", () => {
    expect(nextStep(open(PHASE.Resetting), inWindow, signals, 0).kind).toBe("resetShards");
    expect(nextStep(open(PHASE.Ready), inWindow, signals, 0).kind).toBe("settle");
    expect(nextStep(open(PHASE.Voting), inWindow, signals, 0).kind).toBe("castVotes");
    expect(nextStep(open(PHASE.Voted), EPOCH + 7n * DAY, signals, 0)).toMatchObject({ kind: "finalize", label: "Finalize" });
  });

  it("closes rounds that outlived the timeout or the epoch", () => {
    const late = nextStep(open(PHASE.Voting), inWindow + TIMEOUT + 1n, signals, 0);
    expect(late).toMatchObject({ kind: "finalize", label: "Close the stale round" });
    const nextEpoch = nextStep(open(PHASE.Resetting, EPOCH + 6n * DAY), EPOCH + 7n * DAY + 2n * HOUR, signals, 0);
    expect(nextEpoch.kind).toBe("finalize");
  });

  it("applies out-of-date boosts once the market rests, never during a round", () => {
    expect(nextStep(idle, inWindow, quiet, 1)).toMatchObject({ kind: "applyBoosts", label: "Apply boosts" });
    expect(nextStep(idle, inWindow, quiet, 1).detail).toMatch(/^1 buyer's boost is/);
    expect(nextStep(idle, inWindow, quiet, 3).detail).toMatch(/^3 buyers' boosts are/);
    expect(nextStep(idle, EPOCH + HOUR, signals, 2).kind).toBe("applyBoosts");
    expect(nextStep(idle, inWindow, signals, 2).kind).toBe("startRound");
    expect(nextStep(open(PHASE.Voting), inWindow, signals, 2).kind).toBe("castVotes");
  });

  it("names phases, including unknown ones", () => {
    expect(phaseName(PHASE.Voting)).toBe("Voting");
    expect(phaseName(9)).toBe("Phase 9");
    expect(nextStep(open(9), inWindow, signals, 0)).toMatchObject({ kind: "wait", label: "Unknown phase" });
  });
});
