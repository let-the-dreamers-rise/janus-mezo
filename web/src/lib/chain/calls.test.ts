import { decodeFunctionData, getAddress, type Abi, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { calls, type Call } from "./calls";
import { BOOST_GAUGE_FACTORY, marketContract, musdContract, vaultContract, veMezoContract, voterContract } from "./contracts";

const OWNER: Address = "0x00000000000000000000000000000000000000c1";

const decode = (call: Call, contract: { readonly address: Address; readonly abi: Abi }) => {
  expect(call.to).toBe(contract.address);
  const { functionName, args } = decodeFunctionData({ abi: contract.abi, data: call.data });
  return { functionName, args: args ?? [] };
};

describe("calls", () => {
  it("encodes bids against BoostMarket and the MUSD approval it needs", () => {
    expect(decode(calls.approveMusd(5n), musdContract)).toEqual({ functionName: "approve", args: [marketContract.address, 5n] });
    expect(decode(calls.placeOrder(1714n, 50n, 500n, 3n), marketContract)).toEqual({ functionName: "placeOrder", args: [1714n, 50n, 500n, 3n] });
    expect(decode(calls.updateOrder(1n, 60n, 400n), marketContract)).toEqual({ functionName: "updateOrder", args: [1n, 60n, 400n] });
    expect(decode(calls.topUp(1n, 7n), marketContract)).toEqual({ functionName: "topUp", args: [1n, 7n] });
    expect(decode(calls.cancelOrder(1n), marketContract)).toEqual({ functionName: "cancelOrder", args: [1n] });
  });

  it("encodes gauge creation and boost pokes against BoostVoter", () => {
    expect(decode(calls.createGauge(1714n), voterContract)).toEqual({ functionName: "createBoostGauge", args: [BOOST_GAUGE_FACTORY, 1714n, [], []] });
    expect(decode(calls.pokeBoost(1714n), voterContract)).toEqual({ functionName: "pokeBoost", args: [1714n] });
    expect(decode(calls.pokeBoosts([1714n, 1715n]), voterContract)).toEqual({ functionName: "pokeBoosts", args: [[1714n, 1715n]] });
  });

  it("deposits a veMEZO NFT by transferring it to the vault", () => {
    expect(decode(calls.depositShard(OWNER, 930n), veMezoContract)).toEqual({
      functionName: "safeTransferFrom",
      args: [getAddress(OWNER), vaultContract.address, 930n],
    });
    expect(decode(calls.redeem(930n), vaultContract)).toEqual({ functionName: "redeem", args: [930n] });
    expect(decode(calls.claim(), vaultContract)).toEqual({ functionName: "claim", args: [] });
  });

  it("encodes each permissionless round step", () => {
    for (const kind of ["startRound", "settle", "finalize"] as const) {
      expect(decode(calls.roundStep(kind), marketContract)).toEqual({ functionName: kind, args: [] });
    }
    expect(decode(calls.roundBatch("resetShards", 10n), marketContract)).toEqual({ functionName: "resetShards", args: [10n] });
    expect(decode(calls.roundBatch("castVotes", 4n), marketContract)).toEqual({ functionName: "castVotes", args: [4n] });
  });
});
