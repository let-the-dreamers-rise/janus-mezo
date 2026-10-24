import { describe, expect, it } from "vitest";
import { BaseError, RawContractError, UserRejectedRequestError, encodeErrorResult } from "viem";
import { boostMarketAbi } from "@/lib/abi/janus";
import { explainError } from "./errors";

describe("explainError", () => {
  it("turns a decoded revert into the app's sentence", () => {
    const data = encodeErrorResult({ abi: boostMarketAbi, errorName: "OrderLocked", args: [3n] });
    const error = new BaseError("call reverted", { cause: new RawContractError({ data }) });
    expect(explainError(error)).toMatch(/being filled in the open round/);
  });

  it("recognises a rejected wallet request", () => {
    const error = new BaseError("failed", { cause: new UserRejectedRequestError(new Error("nope")) });
    expect(explainError(error)).toBe("You rejected the request in your wallet.");
  });

  it("falls back to short messages for everything else", () => {
    expect(explainError(new BaseError("RPC timed out"))).toBe("RPC timed out");
    expect(explainError(new Error("plain"))).toBe("plain");
    expect(explainError("weird")).toBe("Something went wrong. Try again.");
  });

  it("names unknown contract errors instead of hiding them", () => {
    const data = encodeErrorResult({ abi: boostMarketAbi, errorName: "FeeTooHigh", args: [5_000n] });
    const error = new BaseError("call reverted", { cause: new RawContractError({ data }) });
    expect(explainError(error)).toBe("The contract rejected this: FeeTooHigh.");
  });
});
