import { describe, expect, it } from "vitest";
import { pickRelockable } from "../src/lib/autopilot.js";

describe("pickRelockable", () => {
  it("keeps only tokens the autopilot can extend now", () => {
    const reads = [
      { status: "success" as const, result: true },
      { status: "success" as const, result: false },
      { status: "success" as const, result: true },
    ];
    expect(pickRelockable([1n, 2n, 3n], reads)).toEqual([1n, 3n]);
  });

  it("drops tokens whose read failed", () => {
    const reads = [
      { status: "failure" as const, error: new Error("burned") },
      { status: "success" as const, result: true },
    ];
    expect(pickRelockable([1n, 2n], reads)).toEqual([2n]);
  });

  it("handles no candidates", () => {
    expect(pickRelockable([], [])).toEqual([]);
  });
});
