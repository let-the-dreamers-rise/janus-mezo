import { describe, expect, it } from "vitest";
import { memoryStore, type KeyStore } from "@/lib/demo/key-store";
import { ACTIVITY_ITEM, MAX_ACTIVITY, appendActivity, readActivity, type ActivityEntry } from "./log";

const ME = "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C";
const OTHER = "0x1B2A0915b893B79fE1019a9Dcf141c3669C3D569";
const HASH = `0x${"ab".repeat(32)}` as const;

const entry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  at: 1_000,
  account: ME,
  label: "Placing bid",
  status: "success",
  hash: HASH,
  ...overrides,
});

describe("activity log", () => {
  it("starts empty and lists newest first", () => {
    const store = memoryStore();
    expect(readActivity(store, ME)).toEqual([]);
    appendActivity(store, entry({ at: 1, label: "first" }));
    appendActivity(store, entry({ at: 2, label: "second" }));
    expect(readActivity(store, ME).map((item) => item.label)).toEqual(["second", "first"]);
  });

  it("shows each account only its own entries", () => {
    const store = memoryStore();
    appendActivity(store, entry());
    appendActivity(store, entry({ account: OTHER, label: "theirs" }));
    expect(readActivity(store, ME.toLowerCase()).map((item) => item.label)).toEqual(["Placing bid"]);
    expect(readActivity(store, undefined)).toEqual([]);
  });

  it("keeps only the most recent entries", () => {
    const store = memoryStore();
    for (let i = 0; i < MAX_ACTIVITY + 5; i++) appendActivity(store, entry({ at: i }));
    const items = readActivity(store, ME);
    expect(items).toHaveLength(MAX_ACTIVITY);
    expect(items[0]?.at).toBe(MAX_ACTIVITY + 4);
  });

  it("drops stored values that are not entries", () => {
    const store = memoryStore();
    store.setItem(ACTIVITY_ITEM, JSON.stringify([entry(), { at: "x" }, null, entry({ status: "weird" as never })]));
    expect(readActivity(store, ME)).toHaveLength(1);
    store.setItem(ACTIVITY_ITEM, "{not json");
    expect(readActivity(store, ME)).toEqual([]);
  });

  it("survives storage the browser blocks", () => {
    const blocked: KeyStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    expect(readActivity(blocked, ME)).toEqual([]);
    expect(() => appendActivity(blocked, entry())).not.toThrow();
  });
});
