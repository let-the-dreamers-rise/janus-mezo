import { formatNumber, type FormatOptions, type NumberContext, type SignMode } from "@/lib/format";
import { quoteFromPricePerVote, toNumber, toRaw } from "@/lib/protocol/units";
import { cn } from "@/lib/utils";

/// The kinds of numbers Janus shows. On-chain values arrive as 18-decimal bigints.
export type NumKind = "musd" | "votes" | "mezo" | "jmezo" | "btc" | "boost" | "percent" | "bid";

/// Mezo's BTC has 18 decimals, so one satoshi is 10^10 of its smallest unit.
const SAT_DECIMALS = 10;
/// Amounts under 0.01 BTC read better in sats: "1,000 sats", not "0.0₄1 BTC".
export const SATS_BELOW = 10n ** 16n;
const SATS: FormatOptions = { type: "token_amount", referencePriceUsd: 0.001, unit: "sats" };

const OPTIONS: Record<NumKind, FormatOptions> = {
  musd: { type: "stable_value", unit: "MUSD" },
  votes: { type: "token_amount", referencePriceUsd: 1, unit: "votes" },
  mezo: { type: "token_amount", referencePriceUsd: 1, unit: "MEZO" },
  jmezo: { type: "token_amount", referencePriceUsd: 1, unit: "jMEZO" },
  btc: { type: "token_amount", referencePriceUsd: 100_000, unit: "BTC" },
  boost: { type: "ratio" },
  percent: { type: "percent" },
  bid: { type: "token_price", unit: "MUSD" },
};

interface NumProps {
  readonly value: bigint | number | null | undefined;
  readonly kind: NumKind;
  readonly context?: NumberContext;
  readonly sign?: SignMode;
  /// Drop the unit, for table cells whose header names it.
  readonly bare?: boolean;
  readonly className?: string;
}

interface Normalised {
  readonly num: number;
  /// Full precision in the unit shown, for copy.
  readonly raw: string;
  readonly options: FormatOptions;
}

/// Bids are stored per vote on chain and shown per 1,000 votes; small BTC amounts in sats.
function normalise(value: bigint | number, kind: NumKind): Normalised {
  const options = OPTIONS[kind];
  if (typeof value === "number") return { num: value, raw: String(value), options };
  if (kind === "btc" && value < SATS_BELOW && value > -SATS_BELOW) {
    return { num: toNumber(value, SAT_DECIMALS), raw: toRaw(value, SAT_DECIMALS), options: SATS };
  }
  const scaled = kind === "bid" ? quoteFromPricePerVote(value) : value;
  return { num: toNumber(scaled), raw: toRaw(scaled), options };
}

interface KindOptions {
  readonly context?: NumberContext;
  readonly sign?: SignMode;
  /// Drop the unit, for table cells whose header names it.
  readonly bare?: boolean;
}

export function formatKind(value: bigint | number | null | undefined, kind: NumKind, { context = "compact", sign, bare = false }: KindOptions = {}) {
  if (value === null || value === undefined) return formatNumber(null, { ...OPTIONS[kind], context });
  const { num, raw, options } = normalise(value, kind);
  return formatNumber(num, { ...options, context, sign, unit: bare ? "" : options.unit }, raw);
}

export function Num({ value, kind, context = "compact", sign, bare = false, className }: NumProps) {
  const result = formatKind(value, kind, { context, sign, bare });
  return (
    <span className={cn("num whitespace-nowrap", className)} aria-label={result.ariaLabel} title={result.raw || undefined}>
      {result.display}
    </span>
  );
}
