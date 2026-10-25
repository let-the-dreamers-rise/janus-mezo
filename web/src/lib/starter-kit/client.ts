import { getAddress, isAddress, isHash, type Address, type Hash } from "viem";
import { readEnvelope } from "@/lib/api/envelope";
import { KIT_KINDS, type KitKind, type KitsLeft, type Skipped } from "./kit";

/// The route lives under trailingSlash: true, so the slash saves a redirect.
export const KIT_ENDPOINT = "/api/starter-kit/";

export class KitRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "KitRequestError";
  }
}

export interface KitStatus {
  readonly available: boolean;
  readonly reason?: "not-configured" | "empty";
  readonly faucet?: Address;
  readonly kit?: Readonly<Record<KitKind, bigint>>;
  readonly left?: KitsLeft;
}

export interface ClaimedItem {
  readonly kind: KitKind;
  readonly amount: bigint;
  readonly hash: Hash;
  readonly tokenId?: bigint;
}

export interface KitClaim {
  readonly address: Address;
  readonly sent: readonly ClaimedItem[];
  readonly skipped: readonly Skipped[];
  readonly failed?: { readonly kind: KitKind; readonly message: string };
}

type Fields = Readonly<Record<string, unknown>>;

const malformed = () => new KitRequestError("bad-response", "The server sent an unexpected reply. Try again.");

const fields = (value: unknown): Fields => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw malformed();
  return value as Fields;
};

const big = (value: unknown): bigint => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw malformed();
  return BigInt(value);
};

const kindOf = (value: unknown): KitKind => {
  const kind = KIT_KINDS.find((candidate) => candidate === value);
  if (!kind) throw malformed();
  return kind;
};

const perKind = (value: unknown): Record<KitKind, bigint> => {
  const raw = fields(value);
  return { gas: big(raw.gas), musd: big(raw.musd), veBtc: big(raw.veBtc), veMezo: big(raw.veMezo) };
};

async function request(fetchImpl: typeof fetch, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(KIT_ENDPOINT, { ...init, cache: "no-store" });
  } catch {
    throw new KitRequestError("network", "Could not reach Janus. Check your connection and try again.");
  }
  const json: unknown = await response.json().catch(() => null);
  const envelope = readEnvelope<unknown>(json);
  if (!envelope.ok) throw new KitRequestError(envelope.error.code, envelope.error.message, envelope.error.retryAfterSeconds);
  return envelope.data;
}

function parseStatus(data: unknown): KitStatus {
  const raw = fields(data);
  if (typeof raw.available !== "boolean") throw malformed();
  const reason = raw.reason === "not-configured" || raw.reason === "empty" ? raw.reason : undefined;
  const faucet = typeof raw.faucet === "string" && isAddress(raw.faucet) ? getAddress(raw.faucet) : undefined;
  const left = raw.left === undefined ? undefined : { full: big(fields(raw.left).full), ...perKind(raw.left) };
  return {
    available: raw.available,
    ...(reason ? { reason } : {}),
    ...(faucet ? { faucet } : {}),
    ...(raw.kit === undefined ? {} : { kit: perKind(raw.kit) }),
    ...(left ? { left } : {}),
  };
}

function parseClaim(data: unknown): KitClaim {
  const raw = fields(data);
  if (typeof raw.address !== "string" || !isAddress(raw.address)) throw malformed();
  if (!Array.isArray(raw.sent) || !Array.isArray(raw.skipped)) throw malformed();
  const sent = raw.sent.map((value: unknown): ClaimedItem => {
    const item = fields(value);
    if (typeof item.hash !== "string" || !isHash(item.hash)) throw malformed();
    return {
      kind: kindOf(item.kind),
      amount: big(item.amount),
      hash: item.hash,
      ...(item.tokenId === undefined ? {} : { tokenId: big(item.tokenId) }),
    };
  });
  const skipped = raw.skipped.map((value: unknown): Skipped => {
    const item = fields(value);
    if (item.reason !== "has-enough" && item.reason !== "out-of-stock") throw malformed();
    return { kind: kindOf(item.kind), reason: item.reason };
  });
  const failed =
    raw.failed === undefined
      ? undefined
      : {
          kind: kindOf(fields(raw.failed).kind),
          message: String(fields(raw.failed).message ?? "Part of the kit did not arrive."),
        };
  return { address: getAddress(raw.address), sent, skipped, ...(failed ? { failed } : {}) };
}

export async function fetchKitStatus(fetchImpl: typeof fetch = fetch): Promise<KitStatus> {
  return parseStatus(await request(fetchImpl));
}

/// Asks the faucet for whatever part of the kit `address` is missing. Resolves once every
/// item is confirmed on chain, which takes a few blocks.
export async function claimKit(address: Address, fetchImpl: typeof fetch = fetch): Promise<KitClaim> {
  const data = await request(fetchImpl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  return parseClaim(data);
}
