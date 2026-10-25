"use client";

import { useEffect, useState } from "react";
import { ACTIVITY_EVENT, appendActivity, readActivity, type ActivityEntry } from "@/lib/activity/log";
import { browserStore } from "@/lib/demo/key-store";

/// Saves an entry to this device's activity log and tells open views to refresh.
export function recordActivity(entry: ActivityEntry): void {
  appendActivity(browserStore(), entry);
  window.dispatchEvent(new Event(ACTIVITY_EVENT));
}

/// The account's activity on this device, newest first, kept current across tabs.
export function useActivity(account: string | undefined): readonly ActivityEntry[] {
  const [items, setItems] = useState<readonly ActivityEntry[]>([]);
  useEffect(() => {
    const load = () => setItems(readActivity(browserStore(), account));
    load();
    window.addEventListener(ACTIVITY_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(ACTIVITY_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [account]);
  return items;
}
