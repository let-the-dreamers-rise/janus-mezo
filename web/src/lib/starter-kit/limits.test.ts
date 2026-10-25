import { describe, expect, it } from "vitest";
import { createMutex, slidingWindow } from "./limits";

const MINUTE = 60_000;

describe("slidingWindow", () => {
  it("lets a key act up to the limit, then says how long to wait", () => {
    const limit = slidingWindow({ max: 2, ms: 10 * MINUTE });
    expect(limit.wait("a", 0)).toBe(0);
    limit.hit("a", 0);
    limit.hit("a", MINUTE);
    expect(limit.wait("a", 2 * MINUTE)).toBe(8 * MINUTE);
  });

  it("frees a slot once the oldest hit leaves the window", () => {
    const limit = slidingWindow({ max: 1, ms: MINUTE });
    limit.hit("a", 0);
    expect(limit.wait("a", MINUTE - 1)).toBe(1);
    expect(limit.wait("a", MINUTE)).toBe(0);
  });

  it("keeps keys apart", () => {
    const limit = slidingWindow({ max: 1, ms: MINUTE });
    limit.hit("a", 0);
    expect(limit.wait("b", 0)).toBe(0);
  });

  it("forgets idle keys once it tracks too many", () => {
    const limit = slidingWindow({ max: 1, ms: MINUTE }, 2);
    limit.hit("a", 0);
    limit.hit("b", 0);
    limit.hit("c", 2 * MINUTE);
    expect(limit.size()).toBe(1);
  });

  it("drops the oldest keys when every key is still active", () => {
    const limit = slidingWindow({ max: 1, ms: MINUTE }, 2);
    limit.hit("a", 0);
    limit.hit("b", 1);
    limit.hit("c", 2);
    expect(limit.size()).toBe(2);
    expect(limit.wait("a", 3)).toBe(0);
    expect(limit.wait("c", 3)).toBeGreaterThan(0);
  });
});

describe("createMutex", () => {
  it("runs tasks one at a time, in order", async () => {
    const run = createMutex();
    const order: string[] = [];
    const task = (name: string, ms: number) => () =>
      new Promise<string>((done) => {
        order.push(`start ${name}`);
        setTimeout(() => {
          order.push(`end ${name}`);
          done(name);
        }, ms);
      });
    const results = await Promise.all([run(task("slow", 20)), run(task("fast", 1))]);
    expect(results).toEqual(["slow", "fast"]);
    expect(order).toEqual(["start slow", "end slow", "start fast", "end fast"]);
  });

  it("keeps going after a task fails", async () => {
    const run = createMutex();
    const failed = run(() => Promise.reject(new Error("boom")));
    await expect(failed).rejects.toThrow("boom");
    await expect(run(() => Promise.resolve("next"))).resolves.toBe("next");
  });
});
