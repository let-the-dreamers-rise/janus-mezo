import { isAddress, isHash, type Hash } from "viem";
import type { KeyStore } from "@/lib/demo/key-store";

/// What this browser sent through Janus: a convenience log kept on this device only. The
/// chain stays the record; this just saves hunting through an explorer.
export const ACTIVITY_ITEM = "janus.activity.v1";
export const ACTIVITY_EVENT = "janus:activity";
export const MAX_ACTIVITY = 30;

export interface ActivityEntry {
  readonly at: number;
  readonly account: string;
  readonly label: string;
  readonly status: "success" | "error";
  readonly hash?: Hash;
  readonly detail?: string;
}

function isEntry(value: unknown): value is ActivityEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.at === "number" &&
    typeof entry.account === "string" &&
    isAddress(entry.account, { strict: false }) &&
    typeof entry.label === "string" &&
    (entry.status === "success" || entry.status === "error") &&
    (entry.hash === undefined || (typeof entry.hash === "string" && isHash(entry.hash))) &&
    (entry.detail === undefined || typeof entry.detail === "string")
  );
}

function readAll(store: KeyStore | undefined): readonly ActivityEntry[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(ACTIVITY_ITEM) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

/// The account's entries, newest first.
export function readActivity(store: KeyStore | undefined, account: string | undefined): readonly ActivityEntry[] {
  if (!account) return [];
  const mine = account.toLowerCase();
  return readAll(store)
    .filter((entry) => entry.account.toLowerCase() === mine)
    .sort((a, b) => b.at - a.at);
}

export function appendActivity(store: KeyStore | undefined, entry: ActivityEntry): void {
  try {
    const next = [...readAll(store), entry].sort((a, b) => a.at - b.at).slice(-MAX_ACTIVITY);
    store?.setItem(ACTIVITY_ITEM, JSON.stringify(next));
  } catch {
    // A full or blocked store only loses this convenience log.
  }
}
