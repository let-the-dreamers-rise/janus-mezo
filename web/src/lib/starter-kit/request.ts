import { getAddress, isAddress, zeroAddress, type Address } from "viem";

export type KitRequest = { readonly ok: true; readonly address: Address } | { readonly ok: false; readonly message: string };

/// Validates a starter-kit request body: `{ "address": "0x..." }`. Mixed-case addresses must
/// carry a valid checksum, as wallets produce them.
export function parseKitRequest(body: unknown): KitRequest {
  if (typeof body !== "object" || body === null) return { ok: false, message: "Send a JSON body with an address." };
  const { address } = body as { readonly address?: unknown };
  if (typeof address !== "string" || !isAddress(address)) {
    return { ok: false, message: "That is not a valid Mezo address." };
  }
  const checksummed = getAddress(address);
  if (checksummed === zeroAddress) return { ok: false, message: "That is not a valid Mezo address." };
  return { ok: true, address: checksummed };
}

/// The caller's IP address. Vercel sets x-forwarded-for itself, so its first hop is the
/// client. Callers without one share a single bucket.
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || "unknown";
}
