/** @type {import('next').NextConfig} */
const nextConfig = {
  // Janus is a client-side dApp: every page is static and reads the chain in the browser.
  output: "export",
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
