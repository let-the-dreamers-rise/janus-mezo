import { NETWORK_INFO, networkInfo } from "./network";

export const SITE = {
  name: "Janus",
  tagline: "The boost market for Mezo",
  description:
    "veBTC holders bid MUSD for the veMEZO votes that lift their Mezo Earn boost up to 5x. " +
    "veMEZO holders pool their locks in one vault and earn 90% of every payment.",
  repoUrl: "https://github.com/let-the-dreamers-rise/janus-mezo",
  explorerUrl: NETWORK_INFO.explorerUrl,
  /// The evidence on /proof stays on these explorers whichever network the site runs on.
  matsnetExplorerUrl: networkInfo("matsnet").explorerUrl,
  mainnetExplorerUrl: networkInfo("mainnet").explorerUrl,
  faucetUrl: "https://faucet.test.mezo.org",
  mezoDocsUrl: "https://mezo.org/docs",
} as const;
