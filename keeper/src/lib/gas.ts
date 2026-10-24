/// Mezo matsnet's block gas limit.
export const BLOCK_GAS_LIMIT = 10_000_000n;
/// Largest gas limit a transaction is sent with, leaving room for others in the block.
export const MAX_TX_GAS = 9_500_000n;

/// The gas limit to send with: the estimate plus half again, capped to fit a block.
/// Matsnet estimates can come in low. A veMEZO deposit sent one block after its lock was
/// minted was estimated at 545k gas and reverted, while it needs between 600k and 800k.
/// Gas costs a few hundred wei here, so the margin is close to free.
export function gasWithHeadroom(estimate: bigint, cap: bigint = MAX_TX_GAS): bigint {
  const padded = estimate + estimate / 2n;
  return padded < cap ? padded : cap;
}

/// A revert that burned at least 90% of its limit most likely ran out of gas: either the
/// whole limit, or all but the 1/64 that EIP-150 keeps back when an inner call runs dry.
/// Matsnet's eth_estimateGas has returned 21k for a 204k call, so the sender retries such
/// a transaction once with the full cap after simulating it again.
export function likelyOutOfGas(gasUsed: bigint, gasLimit: bigint): boolean {
  return gasUsed * 10n >= gasLimit * 9n;
}
