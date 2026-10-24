"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { IS_DEPLOYED } from "@/config/deployment";
import { readAccountSnapshot } from "@/lib/chain/account-snapshot";
import { mezoTestnet, useWalletAccount } from "@/lib/wallet/passport";
import { useWatchAddress } from "./use-watch-address";

export const accountQueryKey = (address: string | undefined) =>
  ["janus", "account", address?.toLowerCase() ?? "none"] as const;

/// The connected account: an EVM wallet, or the Mezo smart account behind a Bitcoin wallet.
/// Without a wallet, an address from ?as= is read instead and `readOnly` is true.
export function useJanusAccount() {
  const { accountAddress, walletAddress, networkFamily, isConnected, chainId } = useWalletAccount();
  const watched = useWatchAddress();
  const address = isConnected ? accountAddress : watched;
  const client = usePublicClient({ chainId: mezoTestnet.id });
  const query = useQuery({
    queryKey: accountQueryKey(address),
    queryFn: () => {
      if (!client || !address) throw new Error("Connect a wallet first");
      return readAccountSnapshot(client, address);
    },
    enabled: IS_DEPLOYED && Boolean(client) && Boolean(address),
    refetchInterval: 20_000,
  });
  return {
    address,
    walletAddress,
    networkFamily,
    isConnected,
    readOnly: !isConnected && Boolean(watched),
    wrongNetwork: isConnected && networkFamily === "evm" && chainId !== mezoTestnet.id,
    ...query,
  };
}
