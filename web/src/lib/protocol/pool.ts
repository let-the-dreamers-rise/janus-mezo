const BPS = 10_000n;
const ONE = 10n ** 18n;

export interface PoolReserves {
  readonly jmezo: bigint;
  readonly musd: bigint;
  readonly feeBps: bigint;
}

export type SwapSide = "sell" | "buy";

/// What a volatile Mezo DEX pool pays out, as Pool.getAmountOut computes it.
export function quoteSwap(pool: PoolReserves, side: SwapSide, amountIn: bigint): bigint {
  const [reserveIn, reserveOut] = side === "sell" ? [pool.jmezo, pool.musd] : [pool.musd, pool.jmezo];
  if (amountIn === 0n || reserveIn === 0n || reserveOut === 0n) return 0n;
  const afterFee = amountIn - (amountIn * pool.feeBps) / BPS;
  return (afterFee * reserveOut) / (reserveIn + afterFee);
}

/// MUSD per jMEZO at the pool's current reserves, scaled to 18 decimals.
export function priceOfJmezo(pool: PoolReserves): bigint | null {
  return pool.jmezo === 0n ? null : (pool.musd * ONE) / pool.jmezo;
}

export const minReceived = (amountOut: bigint, slippageBps: bigint): bigint => (amountOut * (BPS - slippageBps)) / BPS;
