"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Address } from "viem";
import { claimKit, fetchKitStatus } from "@/lib/starter-kit/client";
import { describeClaim } from "@/lib/starter-kit/view";

export const kitStatusKey = ["starter-kit", "status"] as const;

/// The faucet's kit status, and the request that sends a wallet whatever it is missing.
export function useStarterKit() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: kitStatusKey, queryFn: () => fetchKitStatus(), staleTime: 60_000, retry: 1 });
  const claim = useMutation({
    mutationFn: (address: Address) => claimKit(address),
    onSuccess: async (result) => {
      const { title, detail } = describeClaim(result);
      if (result.failed) toast.warning(title, { description: detail });
      else toast.success(title, { description: detail });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["janus"] }),
        queryClient.invalidateQueries({ queryKey: kitStatusKey }),
      ]);
    },
    onError: (error) => toast.error("The starter kit did not arrive", { description: error.message }),
  });
  return { status, claim };
}
