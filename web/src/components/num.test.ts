import { describe, expect, it } from "vitest";
import { formatKind } from "./num";

const E18 = 10n ** 18n;

describe("formatKind", () => {
  it("shows small BTC amounts in sats and larger ones in BTC", () => {
    expect(formatKind(10n ** 13n, "btc", { context: "detailed" }).display).toBe("1,000 sats");
    expect(formatKind(10n ** 13n, "btc").display).toBe("1K sats");
    expect(formatKind(10n ** 16n, "btc", { context: "detailed" }).display).toBe("0.01 BTC");
    expect(formatKind((15n * E18) / 10n, "btc", { context: "detailed" }).display).toBe("1.5 BTC");
  });

  it("keeps full precision in the unit shown, for copy", () => {
    expect(formatKind(10n ** 13n, "btc", { context: "detailed" }).raw).toBe("1000");
    expect(formatKind((15n * E18) / 10n, "btc").raw).toBe("1.5");
  });

  it("shows bids per 1,000 votes, with or without the unit", () => {
    expect(formatKind(5n * 10n ** 16n, "bid").display).toBe("50.0 MUSD");
    expect(formatKind(5n * 10n ** 16n, "bid", { bare: true }).display).toBe("50.0");
  });

  it("signs a value only when asked", () => {
    expect(formatKind(2n * E18, "musd", { sign: "always" }).display).toBe("+2.00 MUSD");
    expect(formatKind(2n * E18, "musd").display).toBe("2.00 MUSD");
  });

  it("renders missing values as a placeholder", () => {
    expect(formatKind(undefined, "btc").display).toBe("--");
    expect(formatKind(null, "votes").display).toBe("--");
  });
});
