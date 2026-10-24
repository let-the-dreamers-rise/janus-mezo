const UNBOOSTED = 10n ** 18n;
/// A boost below the 5x cap drifts every second as veMEZO and veBTC voting power decay,
/// about 0.006x a week for a 2.8x boost. Rounds move boosts by whole multiples, so only a
/// gap above 0.01x is worth a 200k-gas poke.
export const BOOST_TOLERANCE = 10n ** 16n;

export interface BoostRead {
  readonly tokenId: bigint;
  /// veBTC locked(tokenId).boost: the boost the NFT earns with now. Zero if never poked.
  readonly applied: bigint;
  /// BoostVoter.getBoost(tokenId): what a poke would apply.
  readonly live: bigint;
}

/// Nonzero ids without duplicates, in first-seen order.
export function uniqueIds(ids: readonly bigint[]): bigint[] {
  return [...new Set(ids.filter((id) => id > 0n))];
}

/// veBTC NFTs whose applied boost is more than BOOST_TOLERANCE away from the live one.
/// Poking them gives this round's buyers the boost they paid for and ends boost nobody
/// is paying for anymore.
export function staleBoosts(reads: readonly BoostRead[], tolerance: bigint = BOOST_TOLERANCE): bigint[] {
  const differs = reads.filter(({ applied, live }) => {
    const gap = (applied === 0n ? UNBOOSTED : applied) - live;
    return gap > tolerance || -gap > tolerance;
  });
  return uniqueIds(differs.map(({ tokenId }) => tokenId));
}
