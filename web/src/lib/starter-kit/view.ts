import type { AccountSnapshot } from "@/lib/chain/account-snapshot";
import type { ClaimedItem, KitClaim } from "./client";
import type { Holdings, KitKind } from "./kit";

export const KIT_LABELS: Readonly<Record<KitKind, string>> = {
  gas: "gas BTC",
  musd: "MUSD",
  veBtc: "veBTC NFT",
  veMezo: "veMEZO NFT",
};

/// What the kit counts in an account snapshot.
export const holdingsOf = (account: AccountSnapshot): Holdings => ({
  btc: account.btc,
  musd: account.musd,
  veBtcCount: BigInt(account.veBtc.length),
  veMezoCount: BigInt(account.veMezo.length),
  jmezo: account.jmezo,
});

const nameOf = (item: ClaimedItem): string =>
  item.tokenId === undefined ? KIT_LABELS[item.kind] : `${KIT_LABELS[item.kind]} #${item.tokenId.toString()}`;

/// "a", "a and b", "a, b and c".
export function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/// The toast for a finished kit request.
export function describeClaim(claim: KitClaim): { readonly title: string; readonly detail: string } {
  const sent = listOf(claim.sent.map(nameOf));
  if (claim.failed) {
    const failed = `The ${KIT_LABELS[claim.failed.kind]} did not go through: ${claim.failed.message}`;
    if (claim.sent.length === 0) return { title: "The starter kit did not arrive", detail: failed };
    return { title: "Part of the starter kit arrived", detail: `${capitalised(sent)} arrived. ${failed} Ask again for the rest.` };
  }
  if (claim.sent.length === 0) {
    return { title: "You already have the whole kit", detail: "Nothing was sent: your wallet holds every item." };
  }
  return { title: "Starter kit sent", detail: `${capitalised(sent)} are in your wallet.` };
}
