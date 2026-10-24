import { describe, expect, it } from "vitest";
import { formatDuration, formatUtc } from "./time";

describe("formatDuration", () => {
  it("shows the two largest units", () => {
    expect(formatDuration(3 * 86_400 + 4 * 3_600 + 59)).toBe("3d 4h");
    expect(formatDuration(4 * 3_600 + 12 * 60 + 9)).toBe("4h 12m");
    expect(formatDuration(12 * 60 + 5)).toBe("12m 5s");
    expect(formatDuration(45n)).toBe("45s");
  });

  it("skips empty middle units and clamps at zero", () => {
    expect(formatDuration(86_400 + 30)).toBe("1d");
    expect(formatDuration(86_400 + 3_600)).toBe("1d 1h");
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(-5)).toBe("0s");
  });
});

describe("formatUtc", () => {
  it("formats in UTC", () => {
    expect(formatUtc(1_792_627_200)).toBe("Oct 22, 12:00 AM UTC");
  });
});
