import { SITE } from "@/config/site";

/// Plain helpers, usable from server and client components alike.
export const shortAddress = (address: string): string => `${address.slice(0, 6)}...${address.slice(-4)}`;

export const explorerUrl = (kind: "address" | "tx" | "token", value: string): string =>
  `${SITE.explorerUrl}/${kind}/${value}`;

/// Blockscout's page for one NFT of a collection.
export const nftUrl = (collection: string, tokenId: bigint): string =>
  `${SITE.explorerUrl}/token/${collection}/instance/${tokenId.toString()}`;
