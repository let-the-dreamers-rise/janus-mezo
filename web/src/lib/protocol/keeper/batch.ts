// Generated from keeper/src/lib/batch.ts by keeper/scripts/sync-artifacts.ts. Do not edit by hand.
/// Splits `items` into consecutive groups of at most `size` items.
export function chunks<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new Error("chunk size must be a positive integer");
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

/// Gas for a batch of `size`, or null when the call would revert or cannot be estimated.
export type GasEstimator = (size: bigint) => Promise<bigint | null>;

export interface FittedBatch {
  readonly size: bigint;
  readonly gas: bigint;
}

/// The largest batch, halving down from `start`, whose estimate fits `budget`. A shard that
/// votes or resets many gauges costs several million gas, so a fixed batch size can exceed
/// the 10M block limit while a smaller one would go through.
export async function fitBatch(start: bigint, budget: bigint, estimate: GasEstimator): Promise<FittedBatch | null> {
  if (start < 1n) throw new Error("batch size must be at least 1");
  for (let size = start; size >= 1n; size /= 2n) {
    const gas = await estimate(size);
    if (gas !== null && gas <= budget) return { size, gas };
  }
  return null;
}
