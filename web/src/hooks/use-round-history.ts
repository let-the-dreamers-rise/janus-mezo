"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { DEPLOYMENT, IS_DEPLOYED } from "@/config/deployment";
import { readRoundHistory } from "@/lib/chain/round-history";
import { mezoTestnet } from "@/lib/wallet/passport";

/// Every round since deployment, read from BoostMarket's events once a minute.
export function useRoundHistory() {
  const client = usePublicClient({ chainId: mezoTestnet.id });
  return useQuery({
    queryKey: ["janus", "history"],
    queryFn: () => {
      if (!client) throw new Error("No Mezo client is available");
      return readRoundHistory(client, DEPLOYMENT.deployedAtBlock);
    },
    enabled: IS_DEPLOYED && Boolean(client),
    refetchInterval: 60_000,
  });
}
