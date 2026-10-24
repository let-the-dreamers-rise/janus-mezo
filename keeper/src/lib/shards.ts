/// Per-shard BoostVoter reads, index-aligned with `ids`.
export interface ShardReads {
  readonly ids: readonly bigint[];
  readonly lastVoted: readonly bigint[];
  readonly usedWeights: readonly bigint[];
}

export interface ShardSignals {
  /// Some vault shard has not voted this epoch and could still sell votes.
  readonly eligible: boolean;
  /// Some such shard still carries votes from an earlier epoch that no round has tried to clear.
  readonly stale: boolean;
}

/// `attempts` maps each shard the latest round of this epoch snapshotted to the power it
/// recorded. A shard recorded at zero power could not be reset or sold, and would not be
/// on a second try either, so it no longer starts rounds. One that abstained with power
/// stays sellable for demand that arrives later in the epoch.
export function summarizeShards(
  reads: ShardReads,
  epoch: bigint,
  attempts: ReadonlyMap<bigint, bigint>,
): ShardSignals {
  const open = reads.ids.map((_, i) => (reads.lastVoted[i] ?? epoch) < epoch);
  return {
    eligible: reads.ids.some((id, i) => open[i] && attempts.get(id) !== 0n),
    stale: reads.ids.some((id, i) => open[i] && (reads.usedWeights[i] ?? 0n) > 0n && !attempts.has(id)),
  };
}
