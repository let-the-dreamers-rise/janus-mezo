/// Display formatting for every number Janus shows. Display only: math stays in bigint.
/// Follows the number formatting spec: no scientific notation, no signed zero, "--" for
/// missing values, tiny markers instead of fake zeros, zero-subscript for long leading
/// zeros, abbreviations only in compact views, and raw precision for copy.
export type NumberType = "stable_value" | "token_amount" | "token_price" | "percent" | "ratio";
export type NumberContext = "compact" | "detailed";
export type SignMode = "auto" | "always" | "never";

export interface FormatOptions {
  readonly type: NumberType;
  readonly context?: NumberContext;
  /// USD price of one token. Drives token_amount decimals; 4 decimals when unknown.
  readonly referencePriceUsd?: number;
  /// Unit written after the number, such as "MUSD". Replaces the $ prefix; "" shows no unit.
  readonly unit?: string;
  readonly sign?: SignMode;
}

export interface Formatted {
  readonly display: string;
  /// Full-precision decimal for copy and export.
  readonly raw: string;
  readonly ariaLabel: string;
  readonly isTiny: boolean;
  readonly isSubscript: boolean;
}

export const PLACEHOLDER = "--";

const SUBSCRIPT = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
const SUFFIXES = [
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
] as const;

const grouped = (abs: number, minDecimals: number, maxDecimals: number): string =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
    useGrouping: true,
  }).format(abs);

export function toDecimalString(value: number): string {
  if (value === 0) return "0";
  const text = value.toString();
  if (!/e/i.test(text)) return text;
  return value.toFixed(20).replace(/\.?0+$/, "");
}

function countLeadingZeros(abs: number): number {
  if (abs >= 1) return 0;
  const decimals = abs.toFixed(20).split(".")[1] ?? "";
  const match = /^0*/.exec(decimals);
  return match ? match[0].length : 0;
}

/// "0.0₄58" for 0.000058. `trim` drops trailing zeros, as amounts do and prices do not.
function subscript(abs: number, sigDigits: number, trim = false): { core: string; expanded: string } {
  const zeros = countLeadingZeros(abs);
  const rounded = abs.toFixed(zeros + sigDigits);
  const fixed = trim ? rounded.replace(/0+$/, "") : rounded;
  const digits = (fixed.split(".")[1] ?? "").slice(zeros, zeros + sigDigits);
  const index = String(zeros)
    .split("")
    .map((d) => SUBSCRIPT[Number(d)] ?? d)
    .join("");
  return { core: `0.0${index}${digits}`, expanded: fixed };
}

/// "1.2K": one decimal in compact, two in detailed, trailing zeros trimmed, and a value that
/// rounds up to 1000 of one unit moves to the next (999,960 is "1M", not "1000K").
function abbreviate(abs: number, context: NumberContext): string | null {
  const decimals = context === "compact" ? 1 : 2;
  for (let i = 0; i < SUFFIXES.length; i++) {
    const tier = SUFFIXES[i];
    if (!tier || abs < tier.value) continue;
    let scaled = Number((abs / tier.value).toFixed(decimals));
    let suffix: string = tier.suffix;
    const larger = SUFFIXES[i - 1];
    if (scaled >= 1000 && larger) {
      scaled = Number((abs / larger.value).toFixed(decimals));
      suffix = larger.suffix;
    }
    return `${grouped(scaled, 0, decimals)}${suffix}`;
  }
  return null;
}

interface Piece {
  readonly core: string;
  readonly tiny?: boolean;
  readonly subscript?: boolean;
  readonly expanded?: string;
}

function stablePiece(abs: number, context: NumberContext): Piece {
  if (abs < 0.005) return { core: "0.01", tiny: true };
  if (context === "compact") {
    const short = abbreviate(abs, context);
    if (short) return { core: short };
  }
  return { core: grouped(abs, 2, 2) };
}

function tokenDecimals(context: NumberContext, priceUsd: number | undefined): number {
  if (priceUsd === undefined || !(priceUsd > 0)) return 4;
  const threshold = context === "compact" ? 0.01 : 0.0001;
  const max = context === "compact" ? 6 : 12;
  const decimals = Math.ceil(-Math.log10(threshold / priceUsd));
  return Math.min(max, Math.max(0, decimals));
}

function tokenPiece(abs: number, context: NumberContext, priceUsd: number | undefined): Piece {
  const decimals = tokenDecimals(context, priceUsd);
  if (Number(abs.toFixed(decimals)) === 0) {
    const marker = context === "compact" ? "0.001" : toDecimalString(10 ** -Math.max(decimals, 1));
    return { core: marker, tiny: true };
  }
  if (countLeadingZeros(abs) >= 3) {
    const { core, expanded } = subscript(abs, context === "compact" ? 2 : 4, true);
    return { core, subscript: true, expanded };
  }
  if (context === "compact") {
    const short = abbreviate(abs, context);
    if (short) return { core: short };
  }
  return { core: grouped(abs, 0, decimals) };
}

function significantDecimals(abs: number, sigDigits: number): number {
  return Math.min(8, countLeadingZeros(abs) + sigDigits);
}

function pricePiece(abs: number, context: NumberContext): Piece {
  const compact = context === "compact";
  if (abs >= 1000) return { core: grouped(abs, 2, 2) };
  if (abs >= 100) return { core: compact ? grouped(abs, 0, 0) : grouped(abs, 2, 2) };
  if (abs >= 1) return { core: compact ? grouped(abs, 1, 1) : grouped(abs, 3, 3) };
  if (countLeadingZeros(abs) >= 3) {
    const { core, expanded } = subscript(abs, compact ? 2 : 4);
    return { core, subscript: true, expanded };
  }
  const decimals = significantDecimals(abs, compact ? 3 : 5);
  return { core: grouped(abs, decimals, decimals) };
}

function percentPiece(abs: number, context: NumberContext): Piece {
  if (abs < 0.005) return { core: "0.01", tiny: true };
  if (abs >= 1000) return { core: context === "compact" ? grouped(abs, 0, 0) : grouped(abs, 0, 1) };
  if (abs >= 100) return { core: grouped(abs, 1, 1) };
  return { core: grouped(abs, 2, 2) };
}

function ratioPiece(abs: number): Piece {
  if (abs < 0.005) return { core: "0.01", tiny: true };
  return { core: grouped(abs, 0, 2) };
}

const ZERO: Record<NumberType, string> = {
  stable_value: "0.00",
  token_amount: "0",
  token_price: "0.00",
  percent: "0.00",
  ratio: "0",
};

function decorate(core: string, options: FormatOptions): string {
  const { type, unit } = options;
  if (type === "percent") return `${core}%`;
  if (type === "ratio") return `${core}x`;
  // A named unit follows the number; an empty one means a bare number, as in a column
  // whose header names the unit.
  if (unit !== undefined) return unit === "" ? core : `${core} ${unit}`;
  if (type === "stable_value" || type === "token_price") return `$${core}`;
  return core;
}

function signOf(negative: boolean, mode: SignMode): string {
  if (mode === "never") return "";
  if (negative) return "-";
  return mode === "always" ? "+" : "";
}

export function formatNumber(value: number | null | undefined, options: FormatOptions, raw?: string): Formatted {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { display: PLACEHOLDER, raw: "", ariaLabel: "no data", isTiny: false, isSubscript: false };
  }
  const context = options.context ?? "compact";
  const exact = raw ?? toDecimalString(value);
  if (value === 0) {
    const display = decorate(ZERO[options.type], options);
    return { display, raw: "0", ariaLabel: display, isTiny: false, isSubscript: false };
  }

  const abs = Math.abs(value);
  const piece: Piece = (() => {
    switch (options.type) {
      case "stable_value":
        return stablePiece(abs, context);
      case "token_amount":
        return tokenPiece(abs, context, options.referencePriceUsd);
      case "token_price":
        return pricePiece(abs, context);
      case "percent":
        return percentPiece(abs, context);
      case "ratio":
        return ratioPiece(abs);
    }
  })();

  const sign = signOf(value < 0, options.sign ?? "auto");
  const body = decorate(piece.core, options);
  const display = piece.tiny ? `${sign}<${body}` : `${sign}${body}`;
  const ariaLabel = piece.subscript && piece.expanded ? `${sign}${decorate(piece.expanded, options)}` : display;
  return { display, raw: exact, ariaLabel, isTiny: Boolean(piece.tiny), isSubscript: Boolean(piece.subscript) };
}
