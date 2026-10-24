"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { IS_DEPLOYED } from "@/config/deployment";
import { readMarketSnapshot } from "@/lib/chain/market-snapshot";
import { mezoTestnet } from "@/lib/wallet/passport";

export const MARKET_QUERY_KEY = ["janus", "market"] as const;

/// Everything public about the market and the vault, read in one block every 15 seconds.
export function useMarket() {
  const client = usePublicClient({ chainId: mezoTestnet.id });
  return useQuery({
    queryKey: MARKET_QUERY_KEY,
    queryFn: () => {
      if (!client) throw new Error("No Mezo client is available");
      return readMarketSnapshot(client);
    },
    enabled: IS_DEPLOYED && Boolean(client),
    refetchInterval: 15_000,
  });
}
