"use client";

import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";
import { ThemeProvider, useTheme } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createWagmiConfig } from "@/lib/wallet/config";
import { mezoTestnet } from "@/lib/wallet/passport";

const rainbowShared = { borderRadius: "medium", fontStack: "system" } as const;
const rainbowLight = lightTheme({ ...rainbowShared, accentColor: "hsl(32 65% 34%)", accentColorForeground: "hsl(40 60% 97%)" });
const rainbowDark = darkTheme({ ...rainbowShared, accentColor: "hsl(35 62% 58%)", accentColorForeground: "hsl(30 30% 8%)" });

function WalletLayer({ children }: { children: ReactNode }) {
  const { resolved } = useTheme();
  return (
    <RainbowKitProvider initialChain={mezoTestnet} theme={resolved === "dark" ? rainbowDark : rainbowLight}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster theme={resolved} position="bottom-right" closeButton richColors />
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [wagmiConfig] = useState(createWagmiConfig);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 2 } },
      }),
  );
  return (
    <ThemeProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <WalletLayer>{children}</WalletLayer>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
