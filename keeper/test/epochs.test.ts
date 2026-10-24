import { describe, expect, it } from "vitest";
import { WEEK, epochNext, epochStart, inVoteWindow, voteEnd, voteStart } from "../src/lib/epochs.js";

// Thursday 2026-10-22 00:00:00 UTC, a Mezo epoch boundary.
const EPOCH = 1_792_627_200n;
const HOUR = 3_600n;
const DAY = 24n * HOUR;

describe("epochs", () => {
  it("floors any timestamp to the Thursday that starts its week", () => {
    expect(epochStart(EPOCH)).toBe(EPOCH);
    expect(epochStart(EPOCH + 3n * DAY + 5n * HOUR)).toBe(EPOCH);
    expect(epochStart(EPOCH + WEEK)).toBe(EPOCH + WEEK);
    expect(epochNext(EPOCH + DAY)).toBe(EPOCH + WEEK);
  });

  it("opens the vote window one hour in and closes it one hour before the end", () => {
    expect(voteStart(EPOCH + DAY)).toBe(EPOCH + HOUR);
    expect(voteEnd(EPOCH + DAY)).toBe(EPOCH + WEEK - HOUR);
  });

  it("matches NonStakingVoter's boundary checks exactly", () => {
    expect(inVoteWindow(EPOCH + HOUR)).toBe(false);
    expect(inVoteWindow(EPOCH + HOUR + 1n)).toBe(true);
    expect(inVoteWindow(EPOCH + WEEK - HOUR)).toBe(true);
    expect(inVoteWindow(EPOCH + WEEK - HOUR + 1n)).toBe(false);
  });
});
