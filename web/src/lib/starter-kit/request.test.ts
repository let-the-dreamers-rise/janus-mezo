import { describe, expect, it } from "vitest";
import { clientIp, parseKitRequest } from "./request";

const ADDRESS = "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C";

describe("parseKitRequest", () => {
  it("accepts an address in any case and returns it checksummed", () => {
    expect(parseKitRequest({ address: ADDRESS.toLowerCase() })).toEqual({ ok: true, address: ADDRESS });
  });

  it.each([
    ["no body", null],
    ["a string body", "0x8f78"],
    ["a missing address", {}],
    ["a number", { address: 42 }],
    ["a short address", { address: "0x8f78545c" }],
    ["a bad checksum", { address: "0x8F78545c43124dEfb1aF52f03c6F4782C905Cb5C" }],
    ["the zero address", { address: "0x0000000000000000000000000000000000000000" }],
  ])("rejects %s", (_label, body) => {
    const result = parseKitRequest(body);
    expect(result.ok).toBe(false);
  });
});

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
