"use client";

import { useEffect, useState } from "react";

/// Chain time that keeps ticking between reads: the last block timestamp plus the local time
/// elapsed since it was read. Countdowns use it so they do not freeze between refetches.
export function useChainClock(blockTimestamp: bigint | undefined, readAt: number | undefined): bigint | undefined {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  if (blockTimestamp === undefined || readAt === undefined) return undefined;
  const elapsed = Math.max(0, Math.floor((tick - readAt) / 1_000));
  return blockTimestamp + BigInt(elapsed);
}
