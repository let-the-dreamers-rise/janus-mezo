import { existsSync, readFileSync } from "node:fs";

// Local runs read the starter-kit faucet key from the repo-root .env that the keeper scripts
// use, so the key lives in one file. Vercel sets FAUCET_PRIVATE_KEY in the project instead.
const rootEnv = new URL("../.env", import.meta.url);
if (!process.env.FAUCET_PRIVATE_KEY && existsSync(rootEnv)) {
  const match = readFileSync(rootEnv, "utf8").match(/^FAUCET_PRIVATE_KEY=(0x[0-9a-fA-F]{64})\s*$/m);
  if (match) process.env.FAUCET_PRIVATE_KEY = match[1];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Every page is prerendered and reads the chain in the browser. The one server route is
  // /api/starter-kit, which signs testnet starter kits with the faucet key.
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
  // Mezo Passport's OrangeKit packages publish TypeScript sources.
  transpilePackages: [
    "@mezo-org/passport",
    "@mezo-org/orangekit",
    "@mezo-org/orangekit-contracts",
    "@mezo-org/orangekit-smart-account",
  ],
  webpack: (config) => {
    // Optional Node-only dependencies of WalletConnect and pino, never used in the browser.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Janus offers no Coinbase wallet. wagmi re-exports every connector, and the Coinbase SDK
    // ships a worker that Next 14 cannot minify, so it resolves to an empty module instead.
    config.resolve.alias = { ...config.resolve.alias, "@coinbase/wallet-sdk": false };
    return config;
  },
};

export default nextConfig;
