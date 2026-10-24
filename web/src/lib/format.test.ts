import { describe, expect, it } from "vitest";
import { PLACEHOLDER, formatNumber, toDecimalString } from "./format";

const show = (value: number | null | undefined, options: Parameters<typeof formatNumber>[1]) =>
  formatNumber(value, options).display;

describe("formatNumber: missing and zero", () => {
  it("renders null, NaN and infinity as a placeholder", () => {
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(show(value, { type: "stable_value" })).toBe(PLACEHOLDER);
    }
    expect(formatNumber(null, { type: "ratio" }).ariaLabel).toBe("no data");
  });

  it("never shows a signed zero", () => {
    expect(show(-0, { type: "stable_value" })).toBe("$0.00");
    expect(show(-0, { type: "percent", sign: "always" })).toBe("0.00%");
    expect(show(0, { type: "token_amount" })).toBe("0");
    expect(show(0, { type: "ratio" })).toBe("0x");
  });
});

describe("formatNumber: stable values", () => {
  it("keeps two decimals and abbreviates only in compact views", () => {
    expect(show(1234.5, { type: "stable_value" })).toBe("$1.2K");
    expect(show(1234.5, { type: "stable_value", context: "detailed" })).toBe("$1,234.50");
    expect(show(1.52e12, { type: "stable_value" })).toBe("$1.5T");
    expect(show(1.52e12, { type: "stable_value", context: "detailed" })).toBe("$1,520,000,000,000.00");
    expect(show(12, { type: "stable_value" })).toBe("$12.00");
  });

  it("writes a named unit after the number, and nothing for an empty unit", () => {
    expect(show(12, { type: "stable_value", unit: "MUSD" })).toBe("12.00 MUSD");
    expect(show(12, { type: "stable_value", unit: "" })).toBe("12.00");
    expect(show(50, { type: "token_price", unit: "" })).toBe("50.0");
  });

  it("writes a unit instead of the dollar sign when given one", () => {
    expect(show(1234.5, { type: "stable_value", unit: "MUSD" })).toBe("1.2K MUSD");
    expect(show(0.004, { type: "stable_value", unit: "MUSD" })).toBe("<0.01 MUSD");
  });

  it("marks values that would round to zero and keeps their sign when asked", () => {
    expect(show(0.004, { type: "stable_value" })).toBe("<$0.01");
    expect(show(-0.004, { type: "stable_value" })).toBe("-<$0.01");
    expect(formatNumber(0.004, { type: "stable_value" }).isTiny).toBe(true);
  });

  it("moves to the next suffix instead of printing 1000K", () => {
    expect(show(999_960, { type: "stable_value" })).toBe("$1M");
    expect(show(999.999, { type: "stable_value" })).toBe("$1,000.00");
  });
});

describe("formatNumber: token amounts", () => {
  const btc = { type: "token_amount", referencePriceUsd: 100_000 } as const;

  it("derives decimals from the token price and trims trailing zeros", () => {
    expect(show(0.00123456, btc)).toBe("0.001235");
    expect(show(0.01, btc)).toBe("0.01");
    expect(show(0.00123456, { ...btc, context: "detailed" })).toBe("0.00123456");
    expect(show(52_431.5, { type: "token_amount", referencePriceUsd: 1, context: "detailed" })).toBe("52,431.5");
  });

  it("abbreviates large compact amounts", () => {
    expect(show(52_431.5, { type: "token_amount", referencePriceUsd: 1 })).toBe("52.4K");
    expect(show(3_429_723, { type: "token_amount", referencePriceUsd: 1, unit: "votes" })).toBe("3.4M votes");
  });

  it("uses zero-subscript for three or more leading zeros, with an expanded label", () => {
    const small = formatNumber(0.00005835, btc);
    expect(small.display).toBe("0.0₄58");
    expect(small.isSubscript).toBe(true);
    expect(small.ariaLabel).toBe("0.000058");
    expect(show(-0.00005835, { ...btc, context: "detailed" })).toBe("-0.0₄5835");
  });

  it("trims trailing zeros after a zero-subscript amount, but not a price", () => {
    expect(show(0.00001, { ...btc, context: "detailed" })).toBe("0.0₄1");
    expect(show(0.00005, { type: "token_price" })).toBe("$0.0₄50");
  });

  it("treats an amount worth less than the display threshold as dust", () => {
    expect(show(0.00005835, { type: "token_amount", referencePriceUsd: 0.0001 })).toBe("<0.001");
  });

  it("marks dust that rounds away and falls back to four decimals without a price", () => {
    expect(show(0.0000000004, btc)).toBe("<0.001");
    expect(show(1.23456789, { type: "token_amount" })).toBe("1.2346");
  });
});

describe("formatNumber: prices, percents and ratios", () => {
  it("formats prices by magnitude and never abbreviates them", () => {
    expect(show(84_000, { type: "token_price" })).toBe("$84,000.00");
    expect(show(142.1234, { type: "token_price" })).toBe("$142");
    expect(show(142.1234, { type: "token_price", context: "detailed" })).toBe("$142.12");
    expect(show(12.3456, { type: "token_price" })).toBe("$12.3");
    expect(show(12.3456, { type: "token_price", context: "detailed" })).toBe("$12.346");
    expect(show(0.1235, { type: "token_price" })).toBe("$0.124");
    expect(show(0.1235, { type: "token_price", context: "detailed" })).toBe("$0.12350");
    expect(show(0.00005835, { type: "token_price" })).toBe("$0.0₄58");
    expect(show(1.5, { type: "token_price", unit: "MUSD" })).toBe("1.5 MUSD");
  });

  it("formats percents with magnitude-based decimals", () => {
    expect(show(12.345, { type: "percent" })).toBe("12.35%");
    expect(show(123.456, { type: "percent" })).toBe("123.5%");
    expect(show(10_250.4, { type: "percent" })).toBe("10,250%");
    expect(show(10_250.4, { type: "percent", context: "detailed" })).toBe("10,250.4%");
    expect(show(0.004, { type: "percent" })).toBe("<0.01%");
    expect(show(-0.004, { type: "percent", sign: "always" })).toBe("-<0.01%");
    expect(show(12.345, { type: "percent", sign: "always" })).toBe("+12.35%");
  });

  it("formats ratios like boost with up to two decimals", () => {
    expect(show(2.567, { type: "ratio" })).toBe("2.57x");
    expect(show(5, { type: "ratio" })).toBe("5x");
    expect(show(1250, { type: "ratio" })).toBe("1,250x");
    expect(show(0.004, { type: "ratio" })).toBe("<0.01x");
  });
});

describe("raw values", () => {
  it("never use scientific notation", () => {
    expect(toDecimalString(0.00005835)).toBe("0.00005835");
    expect(toDecimalString(1.5e-7)).toBe("0.00000015");
    expect(formatNumber(1234.5, { type: "stable_value" }, "1234.500000000000000001").raw).toBe(
      "1234.500000000000000001",
    );
  });
});
