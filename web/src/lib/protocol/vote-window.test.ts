import { describe, expect, it } from "vitest";
import { nextRoundLabel, voteWindow } from "./vote-window";

const EPOCH = 1_792_627_200n;
const HOUR = 3_600n;
const DAY = 24n * HOUR;
const WEEK = 7n * DAY;

describe("voteWindow", () => {
  it("counts down to the close while voting is open", () => {
    expect(voteWindow(EPOCH + DAY)).toEqual({ open: true, secondsLeft: WEEK - HOUR - DAY, label: "Voting closes in 5d 23h" });
  });

  it("counts down to this epoch's opening during its first hour", () => {
    expect(voteWindow(EPOCH + 600n)).toMatchObject({ open: false, label: "Voting opens in 50m" });
  });

  it("counts down to the next epoch's opening during the last hour", () => {
    expect(voteWindow(EPOCH + WEEK - 1_800n)).toMatchObject({ open: false, label: "Voting opens in 1h 30m" });
  });
});

describe("nextRoundLabel", () => {
  it("counts down to the next epoch's vote window once this one is under way", () => {
    expect(nextRoundLabel(EPOCH + DAY)).toBe("Next round in 6d 1h");
  });

  it("counts down to this epoch's window before it opens", () => {
    expect(nextRoundLabel(EPOCH + 600n)).toBe("Next round in 50m");
  });
});
