/// TypeScript mirror of contracts/src/libraries/BoostMath.sol, itself an exact mirror of
/// Mezo BoostVoter._getBoost. Same integer math and rounding, so the app quotes exactly
/// what the market will charge. Inputs are 1e18-scaled voting power, as read on chain.
export const PRECISION = 10n ** 18n;
export const BASE_BOOST = PRECISION;
export const MAX_BOOST = 5n * PRECISION;
const BOOST_MULTIPLIER = 4n;

/// OpenZeppelin Math.ceilDiv for non-negative operands.
export const ceilDiv = (a: bigint, b: bigint): bigint => (a === 0n ? 0n : (a - 1n) / b + 1n);

export function boostOf(total: bigint, boostableTotal: bigint, boostable: bigint, weight: bigint): bigint {
  const votingRatio = total > 0n ? (weight * PRECISION) / total : 0n;
  const boostableRatio = boostable > 0n ? (boostableTotal * PRECISION) / boostable : 0n;
  const fraction = (BOOST_MULTIPLIER * boostableRatio * votingRatio) / PRECISION;
  const boost = BASE_BOOST + fraction;
  return boost > MAX_BOOST ? MAX_BOOST : boost;
}

/// Minimal gauge weight for which boostOf reaches `target`, or null when the NFT cannot be
/// boosted (no power, no veMEZO supply) or the target is above the 5x cap.
export function votesForBoost(
  total: bigint,
  boostableTotal: bigint,
  boostable: bigint,
  target: bigint,
): bigint | null {
  if (target > MAX_BOOST) return null;
  if (target <= BASE_BOOST) return 0n;
  if (boostable === 0n || total === 0n) return null;
  const boostableRatio = (boostableTotal * PRECISION) / boostable;
  if (boostableRatio === 0n) return null;
  const votingRatio = ceilDiv((target - BASE_BOOST) * PRECISION, BOOST_MULTIPLIER * boostableRatio);
  return ceilDiv(votingRatio * total, PRECISION);
}

/// Votes still missing on a gauge that already holds `currentWeight`.
export function additionalVotes(
  total: bigint,
  boostableTotal: bigint,
  boostable: bigint,
  target: bigint,
  currentWeight: bigint,
): bigint | null {
  const need = votesForBoost(total, boostableTotal, boostable, target);
  if (need === null) return null;
  return need > currentWeight ? need - currentWeight : 0n;
}
