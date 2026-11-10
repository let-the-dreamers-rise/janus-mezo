const BPS = 10_000n;

/// The least a pool operation may return after `slippageBps` of tolerance, rounded down.
export function minOut(amount: bigint, slippageBps: bigint): bigint {
  if (slippageBps < 0n || slippageBps > BPS) throw new Error("slippage must be between 0 and 10000 bps");
  return (amount * (BPS - slippageBps)) / BPS;
}
