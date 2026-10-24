"use client";

import { useChainClock } from "./use-chain-clock";
import { useMarket } from "./use-market";

/// The market snapshot plus chain time that keeps ticking between refetches.
export function useMarketNow() {
  const market = useMarket();
  const now = useChainClock(market.data?.now, market.data ? market.dataUpdatedAt : undefined);
  return { market, now };
}
