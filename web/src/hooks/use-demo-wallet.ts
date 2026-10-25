"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useAccount, useConnect, useConnectors, useDisconnect } from "wagmi";
import { explainError } from "@/lib/errors";
import { DEMO_CONNECTOR_ID, forgetDemoWallet } from "@/lib/wallet/demo-connector";
import { mezoTestnet } from "@/lib/wallet/passport";

/// Connects, detects and forgets the one-click demo wallet.
export function useDemoWallet() {
  const { connector, isConnected } = useAccount();
  const connectors = useConnectors();
  const { connectAsync, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const demo = connectors.find((candidate) => candidate.id === DEMO_CONNECTOR_ID);
  const active = isConnected && connector?.id === DEMO_CONNECTOR_ID;

  const connect = useCallback(async (): Promise<boolean> => {
    if (!demo) {
      toast.error("The demo wallet is not available in this browser.");
      return false;
    }
    try {
      if (isConnected && !active) await disconnectAsync();
      await connectAsync({ connector: demo, chainId: mezoTestnet.id });
      return true;
    } catch (error) {
      toast.error("Could not open the demo wallet", { description: explainError(error) });
      return false;
    }
  }, [active, connectAsync, demo, disconnectAsync, isConnected]);

  const forget = useCallback(async (): Promise<void> => {
    if (active) await disconnectAsync();
    forgetDemoWallet();
    toast.success("Demo wallet forgotten", { description: "Its key is gone from this browser." });
  }, [active, disconnectAsync]);

  return { available: demo !== undefined, active, connect, forget, connecting: isPending };
}
