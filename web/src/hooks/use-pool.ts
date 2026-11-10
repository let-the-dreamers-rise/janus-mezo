"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { IS_DEPLOYED } from "@/config/deployment";
import { readPoolSnapshot } from "@/lib/chain/pool-snapshot";
import { mezoTestnet } from "@/lib/wallet/passport";

/// The jMEZO/MUSD pool and this account's router allowances.
export function usePool(account: Address | undefined) {
  const client = usePublicClient({ chainId: mezoTestnet.id });
  return useQuery({
    queryKey: ["janus", "pool", account?.toLowerCase() ?? "none"] as const,
    queryFn: () => {
      if (!client) throw new Error("No Mezo client is available");
      return readPoolSnapshot(client, account);
    },
    enabled: IS_DEPLOYED && Boolean(client),
    refetchInterval: 15_000,
  });
}
