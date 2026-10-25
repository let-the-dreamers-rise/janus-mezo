import { describe, expect, it } from "vitest";
import type { Step } from "./round-step";
import { runRound } from "./run-round";

const step = (kind: Step["kind"]): Step => ({ kind, label: kind, detail: "" });

/// A market that moves one plan entry forward every time a step succeeds.
function scripted(plan: readonly Step["kind"][], fails: ReadonlySet<number> = new Set()) {
  let position = 0;
  const ran: string[] = [];
  return {
    ran,
    deps: {
      read: async () => position,
      plan: (at: number) => step(plan[at] ?? "wait"),
      run: async (next: Step) => {
        ran.push(next.kind);
        if (fails.has(ran.length - 1)) return false;
        position += 1;
        return true;
      },
    },
  };
}

describe("runRound", () => {
  it("runs every step of a round, then the boost pokes, and stops when the market rests", async () => {
    const market = scripted(["startRound", "resetShards", "settle", "castVotes", "finalize", "applyBoosts"]);
    const result = await runRound(market.deps);
    expect(market.ran).toEqual(["startRound", "resetShards", "settle", "castVotes", "finalize", "applyBoosts"]);
    expect(result.stopped).toBe("done");
  });

  it("repeats batched steps until the contract moves on", async () => {
    const market = scripted(["castVotes", "castVotes", "castVotes", "finalize"]);
    await runRound(market.deps);
    expect(market.ran).toEqual(["castVotes", "castVotes", "castVotes", "finalize"]);
  });

  it("does nothing when the market is waiting", async () => {
    const market = scripted([]);
    const result = await runRound(market.deps);
    expect(market.ran).toEqual([]);
    expect(result).toMatchObject({ stopped: "done", ran: 0, last: { kind: "wait" } });
  });

  it("stops at a failed step", async () => {
    const market = scripted(["startRound", "resetShards", "settle"], new Set([1]));
    const result = await runRound(market.deps);
    expect(market.ran).toEqual(["startRound", "resetShards"]);
    expect(result).toMatchObject({ stopped: "failed", ran: 1, last: { kind: "resetShards" } });
  });

  it("never starts a second round in one run", async () => {
    const market = scripted(["settle", "castVotes", "finalize", "startRound", "resetShards"]);
    const result = await runRound(market.deps);
    expect(market.ran).toEqual(["settle", "castVotes", "finalize"]);
    expect(result.stopped).toBe("done");
  });

  it("gives up after the step limit", async () => {
    const market = scripted(Array.from({ length: 50 }, () => "castVotes" as const));
    const result = await runRound({ ...market.deps, maxSteps: 4 });
    expect(market.ran).toHaveLength(4);
    expect(result.stopped).toBe("limit");
  });

  it("reports each step before running it", async () => {
    const market = scripted(["settle", "finalize"]);
    const seen: string[] = [];
    await runRound({ ...market.deps, onStep: (next, index) => seen.push(`${index}:${next.kind}`) });
    expect(seen).toEqual(["0:settle", "1:finalize"]);
  });
});
