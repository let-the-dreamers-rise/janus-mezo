import type { Hex } from "viem";
import { generatePrivateKey } from "viem/accounts";

/// The demo wallet's key lives in this browser's localStorage, where any script on the
/// Janus origin could read it. That is acceptable for a testnet wallet that only ever
/// holds a starter kit, and the app says so wherever the demo wallet is offered.
export const DEMO_KEY_ITEM = "janus.demo-wallet.key.v1";
const LINKED_ITEM = "janus.demo-wallet.linked";
const PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;

export interface KeyStore {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

export function memoryStore(): KeyStore {
  const items = new Map<string, string>();
  return {
    getItem: (name) => items.get(name) ?? null,
    setItem: (name, value) => void items.set(name, value),
    removeItem: (name) => void items.delete(name),
  };
}

/// localStorage, or undefined on the server and where the browser hides it.
export function browserStore(): KeyStore | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function safely<T>(task: () => T, fallback: T): T {
  try {
    return task();
  } catch {
    return fallback;
  }
}

export function readDemoKey(store: KeyStore | undefined): Hex | undefined {
  const value = safely(() => store?.getItem(DEMO_KEY_ITEM) ?? null, null);
  return value !== null && PRIVATE_KEY.test(value) ? (value as Hex) : undefined;
}

/// The stored key, or a new one saved first. Throws when the browser refuses to store it,
/// since a demo wallet that forgets its key on reload would strand its starter kit.
export function ensureDemoKey(store: KeyStore, generate: () => Hex = generatePrivateKey): Hex {
  const existing = readDemoKey(store);
  if (existing) return existing;
  const key = generate();
  try {
    store.setItem(DEMO_KEY_ITEM, key);
  } catch {
    throw new Error("This browser blocks storage, so the demo wallet cannot keep its key. Allow site data or connect your own wallet.");
  }
  return key;
}

/// Whether the demo wallet should reconnect on the next visit. Disconnecting clears it but
/// keeps the key, so connecting again brings back the same address.
export function setLinked(store: KeyStore | undefined, linked: boolean): void {
  safely(() => (linked ? store?.setItem(LINKED_ITEM, "1") : store?.removeItem(LINKED_ITEM)), undefined);
}

export const isLinked = (store: KeyStore | undefined): boolean =>
  safely(() => store?.getItem(LINKED_ITEM) === "1", false);

export function forgetDemoKey(store: KeyStore | undefined): void {
  safely(() => {
    store?.removeItem(DEMO_KEY_ITEM);
    store?.removeItem(LINKED_ITEM);
  }, undefined);
}
