import { injectedWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Config } from "wagmi";
import { SITE } from "@/config/site";
import { demoWallet } from "./demo-connector";
import {
  getConfig,
  mezoTestnet,
  okxWalletMezoTestnet,
  unisatWalletMezoTestnet,
  xverseWalletMezoTestnet,
} from "./passport";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

/// WalletConnect-based wallets refuse to start without a project id, so without one Janus
/// offers injected EVM wallets (EIP-6963 discovery lists MetaMask, Rabby and others) next
/// to the Mezo Passport Bitcoin wallets.
const evmWallets = projectId ? [metaMaskWallet, walletConnectWallet] : [injectedWallet];

/// Builds the wagmi config. Passport's Bitcoin wallets read `window` when they are listed,
/// so static prerendering gets a wallet-less config; wagmi starts disconnected either way,
/// so the server HTML and the first client render match.
export function createWagmiConfig(): Config {
  if (typeof window === "undefined") {
    return createConfig({
      chains: [mezoTestnet],
      transports: { [mezoTestnet.id]: http() },
      ssr: true,
    });
  }
  return getConfig({
    appName: SITE.name,
    appDescription: SITE.description,
    appUrl: window.location.origin,
    mezoNetwork: "testnet",
    walletConnectProjectId: projectId,
    wallets: [
      {
        groupName: "Bitcoin",
        wallets: [unisatWalletMezoTestnet, okxWalletMezoTestnet, xverseWalletMezoTestnet],
      },
      { groupName: "Ethereum", wallets: evmWallets },
      { groupName: "No wallet? Try it", wallets: [demoWallet] },
    ],
    ssr: true,
  });
}
