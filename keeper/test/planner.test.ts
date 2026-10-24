import { describe, expect, it } from "vitest";
import { PHASE, nextAction, type MarketSignals, type RoundView } from "../src/lib/planner.js";

const EPOCH = 1_792_627_200n;
const HOUR = 3_600n;
const DAY = 24n * HOUR;
const TIMEOUT = 12n * HOUR;
const inWindow = EPOCH + DAY;

const ready: MarketSignals = {
  hasEligibleShards: true,
  hasStaleVotes: false,
  hasDemand: true,
  roundTimeout: TIMEOUT,
};
const idle: RoundView = { phase: PHASE.Idle, epoch: 0n, startedAt: 0n };
const open = (phase: number, startedAt = inWindow): RoundView => ({ phase, epoch: EPOCH, startedAt });

describe("nextAction", () => {
  it("starts a round only when shards can vote and someone wants votes", () => {
    expect(nextAction(idle, inWindow, ready)).toEqual({ kind: "startRound" });
    expect(nextAction(idle, inWindow, { ...ready, hasDemand: false }).kind).toBe("wait");
    expect(nextAction(idle, inWindow, { ...ready, hasEligibleShards: false }).kind).toBe("wait");
  });

  it("runs a clearing round when shards still carry last epoch's votes and nobody bids", () => {
    const stale = { ...ready, hasDemand: false, hasStaleVotes: true };
    expect(nextAction(idle, inWindow, stale)).toEqual({ kind: "startRound" });
    expect(nextAction(idle, inWindow, { ...stale, hasEligibleShards: false }).kind).toBe("wait");
  });

  it("explains why it waits when there is nothing to sell or clear", () => {
    expect(nextAction(idle, inWindow, { ...ready, hasDemand: false })).toEqual({
      kind: "wait",
      code: "no-demand",
      reason: "no order needs votes and no shard holds old votes",
    });
    expect(nextAction(idle, inWindow, { ...ready, hasEligibleShards: false })).toMatchObject({
      code: "sold-out",
    });
  });

  it("never starts a round outside the vote window", () => {
    expect(nextAction(idle, EPOCH + HOUR / 2n, ready)).toEqual({
      kind: "wait",
      code: "window-closed",
      reason: "outside the vote window",
    });
  });

  it("walks an open round through its phases", () => {
    expect(nextAction(open(PHASE.Resetting), inWindow, ready)).toEqual({ kind: "resetShards" });
    expect(nextAction(open(PHASE.Ready), inWindow, ready)).toEqual({ kind: "settle" });
    expect(nextAction(open(PHASE.Voting), inWindow, ready)).toEqual({ kind: "castVotes" });
    expect(nextAction(open(PHASE.Voted), inWindow, ready)).toEqual({ kind: "finalize", stale: false });
  });

  it("closes a round that outlived the timeout or its epoch", () => {
    const late = inWindow + TIMEOUT + 1n;
    expect(nextAction(open(PHASE.Voting), late, ready)).toEqual({ kind: "finalize", stale: true });
    const nextEpoch = EPOCH + 7n * DAY + 2n * HOUR;
    expect(nextAction(open(PHASE.Resetting, EPOCH + 6n * DAY), nextEpoch, ready)).toEqual({
      kind: "finalize",
      stale: true,
    });
  });

  it("finalizes a fully voted round even outside the window", () => {
    expect(nextAction(open(PHASE.Voted), EPOCH + 7n * DAY - HOUR / 2n, ready)).toEqual({
      kind: "finalize",
      stale: false,
    });
  });
});
