import { describe, expect, it } from "vitest";
import { parseDeployment } from "../src/config/deployment.js";

const valid = {
  chainId: 31611,
  deployedAtBlock: 16_344_000,
  vault: "0x1111111111111111111111111111111111111111",
  market: "0x2222222222222222222222222222222222222222",
  owner: "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C",
  treasury: "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C",
  boostVoter: "0x21d7bdf5a5929ad179f8ca0c9014a0b62ae6bfd1",
  veMezo: "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b",
  veBtc: "0x38E35d92E6Bfc6787272A62345856B13eA12130a",
  musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
};

describe("parseDeployment", () => {
  it("accepts a forge deployment record and checksums addresses", () => {
    const parsed = parseDeployment(valid, 31611);
    expect(parsed.boostVoter).toBe("0x21d7bDF5a5929AD179F8cA0c9014A0B62ae6Bfd1");
    expect(parsed.deployedAtBlock).toBe(16_344_000n);
  });

  it("rejects a record for another chain", () => {
    expect(() => parseDeployment(valid, 31612)).toThrow(/expected 31612/);
  });

  it("rejects malformed addresses and missing fields", () => {
    expect(() => parseDeployment({ ...valid, market: "0x123" }, 31611)).toThrow(/market/);
    const { deployedAtBlock: _omit, ...withoutBlock } = valid;
    expect(() => parseDeployment(withoutBlock, 31611)).toThrow(/deployedAtBlock/);
    expect(() => parseDeployment(null, 31611)).toThrow(/JSON object/);
  });
});
