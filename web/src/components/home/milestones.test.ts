import { describe, expect, it } from "vitest";
import { MILESTONES } from "./milestones";

describe("MILESTONES", () => {
  it("lists every shipped item before anything that is next", () => {
    const firstNext = MILESTONES.findIndex((m) => m.status === "next");
    expect(firstNext).toBeGreaterThan(0);
    expect(MILESTONES.slice(firstNext).every((m) => m.status === "next")).toBe(true);
  });

  it("records the mainnet launch as shipped", () => {
    expect(MILESTONES.find((m) => m.name === "Mainnet launch")?.status).toBe("shipped");
  });

  it("has unique names", () => {
    expect(new Set(MILESTONES.map((m) => m.name)).size).toBe(MILESTONES.length);
  });
});
