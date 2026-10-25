import type { Wallet } from "@rainbow-me/rainbowkit";
import { http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ProviderNotFoundError, createConnector } from "wagmi";
import {
  browserStore,
  ensureDemoKey,
  forgetDemoKey,
  isLinked,
  memoryStore,
  readDemoKey,
  setLinked,
  type KeyStore,
} from "@/lib/demo/key-store";
import { createDemoProvider, type DemoProvider } from "@/lib/demo/provider";
import { mezoTestnet } from "./passport";

export const DEMO_CONNECTOR_ID = "janusDemo";

const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="6" fill="#8a5a24"/>' +
  '<circle cx="10.5" cy="14" r="4.5" fill="none" stroke="#f8f5ef" stroke-width="2"/>' +
  '<path d="M15 14h8.5M21 14v3.5M18 14v2.5" stroke="#f8f5ef" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON = `data:image/svg+xml,${encodeURIComponent(ICON_SVG)}`;

/// localStorage keeps the key across visits; memory covers a browser that hides it.
const memory = memoryStore();
const keyStore = (): KeyStore => browserStore() ?? memory;

const addressOf = (key: Hex): Address => privateKeyToAccount(key).address;

/// A wagmi connector for the one-click demo wallet: a fresh key kept in this browser that
/// signs locally. Passport treats it as an EVM wallet, so every Janus flow works with it.
export function demoConnector() {
  return createConnector<DemoProvider>((config) => {
    let cached: { readonly key: Hex; readonly provider: DemoProvider } | undefined;
    const providerFor = (key: Hex): DemoProvider => {
      if (cached?.key !== key) {
        const provider = createDemoProvider({ account: privateKeyToAccount(key), chain: mezoTestnet, transport: http() });
        cached = { key, provider };
      }
      return cached.provider;
    };

    return {
      id: DEMO_CONNECTOR_ID,
      name: "Janus demo wallet",
      type: DEMO_CONNECTOR_ID,
      icon: ICON,
      async connect() {
        const key = ensureDemoKey(keyStore());
        setLinked(keyStore(), true);
        providerFor(key);
        return { accounts: [addressOf(key)], chainId: mezoTestnet.id };
      },
      async disconnect() {
        setLinked(keyStore(), false);
      },
      async getAccounts() {
        const key = readDemoKey(keyStore());
        return key ? [addressOf(key)] : [];
      },
      async getChainId() {
        return mezoTestnet.id;
      },
      async getProvider() {
        const key = readDemoKey(keyStore());
        if (!key) throw new ProviderNotFoundError();
        return providerFor(key);
      },
      async isAuthorized() {
        return isLinked(keyStore()) && readDemoKey(keyStore()) !== undefined;
      },
      async switchChain({ chainId }) {
        if (chainId !== mezoTestnet.id) throw new Error("The demo wallet only works on Mezo Matsnet.");
        return mezoTestnet;
      },
      onAccountsChanged() {},
      onChainChanged() {},
      onDisconnect() {
        config.emitter.emit("disconnect");
      },
    };
  });
}

/// Deletes the demo key from this browser. Disconnect first.
export const forgetDemoWallet = (): void => forgetDemoKey(keyStore());

/// The demo wallet as a RainbowKit wallet, so it also shows in the connect modal.
export const demoWallet = (): Wallet => ({
  id: DEMO_CONNECTOR_ID,
  name: "Janus demo wallet",
  shortName: "Demo wallet",
  iconUrl: ICON,
  iconBackground: "#8a5a24",
  installed: true,
  createConnector: (walletDetails) => createConnector((config) => ({ ...demoConnector()(config), ...walletDetails })),
});
