import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import {
  DEMO_KEY_ITEM,
  ensureDemoKey,
  forgetDemoKey,
  isLinked,
  memoryStore,
  readDemoKey,
  setLinked,
  type KeyStore,
} from "./key-store";

const KEY_A: Hex = `0x${"1a".repeat(32)}`;
const KEY_B: Hex = `0x${"2b".repeat(32)}`;

const broken: KeyStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("demo key store", () => {
  it("has no key until one is made", () => {
    expect(readDemoKey(memoryStore())).toBeUndefined();
    expect(readDemoKey(undefined)).toBeUndefined();
  });

  it("makes a key once and keeps returning it", () => {
    const store = memoryStore();
    let made = 0;
    const generate = () => {
      made++;
      return KEY_A;
    };
    expect(ensureDemoKey(store, generate)).toBe(KEY_A);
    expect(ensureDemoKey(store, generate)).toBe(KEY_A);
    expect(made).toBe(1);
    expect(readDemoKey(store)).toBe(KEY_A);
  });

  it("replaces a stored value that is not a private key", () => {
    const store = memoryStore();
    store.setItem(DEMO_KEY_ITEM, "not-a-key");
    expect(readDemoKey(store)).toBeUndefined();
    expect(ensureDemoKey(store, () => KEY_B)).toBe(KEY_B);
  });

  it("remembers whether the wallet is linked, and forgets everything on request", () => {
    const store = memoryStore();
    ensureDemoKey(store, () => KEY_A);
    expect(isLinked(store)).toBe(false);
    setLinked(store, true);
    expect(isLinked(store)).toBe(true);
    setLinked(store, false);
    expect(isLinked(store)).toBe(false);
    setLinked(store, true);
    forgetDemoKey(store);
    expect(readDemoKey(store)).toBeUndefined();
    expect(isLinked(store)).toBe(false);
  });

  it("survives storage the browser blocks", () => {
    expect(readDemoKey(broken)).toBeUndefined();
    expect(isLinked(broken)).toBe(false);
    expect(() => setLinked(broken, true)).not.toThrow();
    expect(() => forgetDemoKey(broken)).not.toThrow();
    expect(() => ensureDemoKey(broken, () => KEY_A)).toThrow("This browser blocks storage");
  });
});
