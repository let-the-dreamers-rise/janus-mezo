import { describe, expect, it } from "vitest";
import { fail, jsonResponse, ok, readEnvelope } from "./envelope";

describe("envelope", () => {
  it("wraps data and errors in one shape", () => {
    expect(ok({ n: 1 })).toEqual({ ok: true, data: { n: 1 } });
    expect(fail("rate-limited", "Slow down.", 30)).toEqual({
      ok: false,
      error: { code: "rate-limited", message: "Slow down.", retryAfterSeconds: 30 },
    });
    expect(fail("invalid-request", "Bad.")).toEqual({ ok: false, error: { code: "invalid-request", message: "Bad." } });
  });

  it("serialises bigints as decimal strings and never caches", async () => {
    const response = jsonResponse(ok({ amount: 10n ** 20n }), 200);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, data: { amount: "100000000000000000000" } });
  });

  it("sends Retry-After with a rate-limit error", () => {
    const response = jsonResponse(fail("rate-limited", "Slow down.", 90), 429);
    expect(response.headers.get("retry-after")).toBe("90");
  });
});

describe("readEnvelope", () => {
  it("passes a well-formed envelope through", () => {
    expect(readEnvelope({ ok: true, data: 1 })).toEqual({ ok: true, data: 1 });
    expect(readEnvelope({ ok: false, error: { code: "x", message: "y" } })).toEqual({
      ok: false,
      error: { code: "x", message: "y" },
    });
  });

  it("turns anything else into an error envelope", () => {
    expect(readEnvelope("<html>")).toEqual({
      ok: false,
      error: { code: "bad-response", message: "The server sent an unexpected reply. Try again." },
    });
    expect(readEnvelope({ ok: false, error: "nope" }).ok).toBe(false);
  });
});
