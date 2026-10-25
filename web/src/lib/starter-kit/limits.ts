/// In-memory guards for the starter-kit route. They live per server instance, so they slow
/// abuse down rather than stop it; the faucet's small balance is the hard cap.
export interface Window {
  readonly max: number;
  readonly ms: number;
}

export interface Limiter {
  /// Milliseconds until `key` may act again; 0 when it may act now.
  wait(key: string, now: number): number;
  hit(key: string, now: number): void;
  /// Keys currently tracked.
  size(): number;
}

/// Allows `max` hits per key in any `ms`-long window. Past `maxKeys` keys it forgets idle
/// ones first, then the oldest, so memory stays bounded.
export function slidingWindow({ max, ms }: Window, maxKeys = 10_000): Limiter {
  const hits = new Map<string, readonly number[]>();
  const recent = (key: string, now: number): readonly number[] => (hits.get(key) ?? []).filter((t) => now - t < ms);

  const prune = (now: number) => {
    if (hits.size <= maxKeys) return;
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= ms)) hits.delete(key);
    }
    for (const key of hits.keys()) {
      if (hits.size <= maxKeys) return;
      hits.delete(key);
    }
  };

  return {
    wait(key, now) {
      const times = recent(key, now);
      if (times.length < max) return 0;
      const oldest = times[times.length - max] ?? now;
      return oldest + ms - now;
    },
    hit(key, now) {
      const times = [...recent(key, now), now];
      hits.delete(key);
      hits.set(key, times);
      prune(now);
    },
    size: () => hits.size,
  };
}

export type Mutex = <T>(task: () => Promise<T>) => Promise<T>;

/// Runs tasks one after another, so one faucet wallet never signs two kits at once.
export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
}
