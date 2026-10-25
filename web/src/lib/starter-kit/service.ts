import type { Address, Hash } from "viem";
import { fail, ok, type Envelope } from "@/lib/api/envelope";
import { KIT, kitsLeft, planKit, type Holdings, type KitConfig, type KitItem, type KitKind, type Stock } from "./kit";
import { createMutex, slidingWindow, type Limiter, type Mutex } from "./limits";
import { parseKitRequest } from "./request";

export interface SentItem extends KitItem {
  readonly hash: Hash;
  /// The NFT minted to the wallet, for the two lock items.
  readonly tokenId?: bigint;
}

export interface SendReport {
  readonly sent: readonly SentItem[];
  /// The first item that failed, if any did.
  readonly failed?: { readonly kind: KitKind; readonly message: string };
}

/// The faucet wallet on chain. The real one signs with FAUCET_PRIVATE_KEY (see chain.ts).
export interface KitChain {
  readonly faucet: Address;
  readHoldings(address: Address): Promise<Holdings>;
  readStock(): Promise<Stock>;
  /// Sends the items and waits until each is confirmed or has failed.
  send(to: Address, items: readonly KitItem[]): Promise<SendReport>;
}

export interface KitLimits {
  readonly requestsPerIp: Limiter;
  readonly kitsPerIp: Limiter;
  readonly kitsPerAddress: Limiter;
  readonly kitsOverall: Limiter;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const defaultLimits = (): KitLimits => ({
  requestsPerIp: slidingWindow({ max: 12, ms: 10 * MINUTE }),
  kitsPerIp: slidingWindow({ max: 4, ms: DAY }),
  kitsPerAddress: slidingWindow({ max: 2, ms: DAY }),
  kitsOverall: slidingWindow({ max: 60, ms: DAY }),
});

export interface Reply {
  readonly status: number;
  readonly body: Envelope<unknown>;
}

export interface ClaimInput {
  readonly body: unknown;
  readonly ip: string;
  readonly now: number;
}

export interface KitService {
  status(): Promise<Reply>;
  claim(input: ClaimInput): Promise<Reply>;
}

interface KitServiceDeps {
  readonly chain: KitChain | null;
  readonly limits?: KitLimits;
  readonly kit?: KitConfig;
  readonly mutex?: Mutex;
}

const reply = (status: number, body: Envelope<unknown>): Reply => ({ status, body });

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const rateLimited = (waitMs: number, message: string): Reply =>
  reply(429, fail("rate-limited", message, Math.ceil(waitMs / 1000)));

const CHAIN_ERROR = "Mezo did not answer. Try again in a minute.";

export function createKitService({ chain, limits = defaultLimits(), kit = KIT, mutex = createMutex() }: KitServiceDeps): KitService {
  const kitAmounts = { gas: kit.gas, musd: kit.musd, veBtc: kit.veBtc, veMezo: kit.veMezo };

  async function status(): Promise<Reply> {
    if (!chain) return reply(200, ok({ available: false, reason: "not-configured" }));
    let stock: Stock;
    try {
      stock = await chain.readStock();
    } catch (error) {
      console.error("starter-kit status failed", describe(error));
      return reply(502, fail("chain-error", CHAIN_ERROR));
    }
    const left = kitsLeft(stock, kit);
    const available = left.gas > 0n || left.musd > 0n || left.veBtc > 0n || left.veMezo > 0n;
    return reply(200, ok({ available, ...(available ? {} : { reason: "empty" }), faucet: chain.faucet, kit: kitAmounts, left }));
  }

  async function deliver(faucet: KitChain, address: Address, ip: string, now: number): Promise<Reply> {
    let holdings: Holdings;
    let stock: Stock;
    try {
      [holdings, stock] = await Promise.all([faucet.readHoldings(address), faucet.readStock()]);
    } catch (error) {
      console.error("starter-kit read failed", describe(error));
      return reply(502, fail("chain-error", CHAIN_ERROR));
    }
    const plan = planKit(holdings, stock, kit);
    if (plan.send.length === 0) {
      if (plan.skipped.some((skip) => skip.reason === "out-of-stock")) {
        return reply(503, fail("out-of-stock", "The starter kit is out of stock right now. Check back later."));
      }
      return reply(200, ok({ address, sent: [], skipped: plan.skipped }));
    }
    let report: SendReport;
    try {
      report = await faucet.send(address, plan.send);
    } catch (error) {
      console.error("starter-kit send failed", describe(error));
      return reply(502, fail("chain-error", CHAIN_ERROR));
    }
    if (report.sent.length > 0) {
      limits.kitsPerIp.hit(ip, now);
      limits.kitsPerAddress.hit(address.toLowerCase(), now);
      limits.kitsOverall.hit("all", now);
    }
    if (report.sent.length === 0 && report.failed) {
      console.error("starter-kit send failed", report.failed.kind, report.failed.message);
      return reply(502, fail("chain-error", report.failed.message));
    }
    return reply(200, ok({ address, sent: report.sent, skipped: plan.skipped, ...(report.failed ? { failed: report.failed } : {}) }));
  }

  async function claim({ body, ip, now }: ClaimInput): Promise<Reply> {
    if (!chain) return reply(503, fail("unavailable", "The starter kit is not set up on this deployment."));
    const tooSoon = limits.requestsPerIp.wait(ip, now);
    if (tooSoon > 0) return rateLimited(tooSoon, "Too many requests from your network. Wait a few minutes.");
    limits.requestsPerIp.hit(ip, now);

    const request = parseKitRequest(body);
    if (!request.ok) return reply(400, fail("invalid-request", request.message));

    const kitWait = Math.max(
      limits.kitsPerAddress.wait(request.address.toLowerCase(), now),
      limits.kitsPerIp.wait(ip, now),
      limits.kitsOverall.wait("all", now),
    );
    if (kitWait > 0) return rateLimited(kitWait, "This wallet or network has had its starter kits for today.");

    return mutex(() => deliver(chain, request.address, ip, now));
  }

  return { status, claim };
}
