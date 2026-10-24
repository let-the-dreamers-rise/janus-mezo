import type { Hex } from "viem";

const PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;

/// Returns the first well-formed private key among the named environment variables.
/// The key itself never appears in errors or logs.
export function loadSignerKey(names: readonly string[]): Hex {
  for (const name of names) {
    const value = process.env[name];
    if (value && PRIVATE_KEY.test(value)) return value as Hex;
  }
  throw new Error(`Set one of ${names.join(", ")} in the repo .env to a 0x-prefixed 32-byte key`);
}
