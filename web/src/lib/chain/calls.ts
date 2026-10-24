import { encodeFunctionData, type Address, type Hex } from "viem";
import { BOOST_GAUGE_FACTORY, marketContract, musdContract, vaultContract, veMezoContract, voterContract } from "./contracts";

export interface Call {
  readonly to: Address;
  readonly data: Hex;
}

const market = (data: Hex): Call => ({ to: marketContract.address, data });
const voter = (data: Hex): Call => ({ to: voterContract.address, data });
const vault = (data: Hex): Call => ({ to: vaultContract.address, data });

/// Every transaction the app sends, encoded in one place.
export const calls = {
  approveMusd: (amount: bigint): Call => ({
    to: musdContract.address,
    data: encodeFunctionData({ abi: musdContract.abi, functionName: "approve", args: [marketContract.address, amount] }),
  }),
  placeOrder: (tokenId: bigint, pricePerVote: bigint, targetBoost: bigint, escrow: bigint): Call =>
    market(
      encodeFunctionData({ abi: marketContract.abi, functionName: "placeOrder", args: [tokenId, pricePerVote, targetBoost, escrow] }),
    ),
  updateOrder: (orderId: bigint, pricePerVote: bigint, targetBoost: bigint): Call =>
    market(encodeFunctionData({ abi: marketContract.abi, functionName: "updateOrder", args: [orderId, pricePerVote, targetBoost] })),
  topUp: (orderId: bigint, amount: bigint): Call =>
    market(encodeFunctionData({ abi: marketContract.abi, functionName: "topUp", args: [orderId, amount] })),
  cancelOrder: (orderId: bigint): Call =>
    market(encodeFunctionData({ abi: marketContract.abi, functionName: "cancelOrder", args: [orderId] })),
  createGauge: (tokenId: bigint): Call =>
    voter(
      encodeFunctionData({
        abi: voterContract.abi,
        functionName: "createBoostGauge",
        args: [BOOST_GAUGE_FACTORY, tokenId, [], []],
      }),
    ),
  pokeBoost: (tokenId: bigint): Call =>
    voter(encodeFunctionData({ abi: voterContract.abi, functionName: "pokeBoost", args: [tokenId] })),
  pokeBoosts: (tokenIds: readonly bigint[]): Call =>
    voter(encodeFunctionData({ abi: voterContract.abi, functionName: "pokeBoosts", args: [[...tokenIds]] })),
  depositShard: (owner: Address, tokenId: bigint): Call => ({
    to: veMezoContract.address,
    data: encodeFunctionData({
      abi: veMezoContract.abi,
      functionName: "safeTransferFrom",
      args: [owner, vaultContract.address, tokenId],
    }),
  }),
  redeem: (tokenId: bigint): Call => vault(encodeFunctionData({ abi: vaultContract.abi, functionName: "redeem", args: [tokenId] })),
  claim: (): Call => vault(encodeFunctionData({ abi: vaultContract.abi, functionName: "claim" })),
  roundStep: (kind: "startRound" | "settle" | "finalize"): Call =>
    market(encodeFunctionData({ abi: marketContract.abi, functionName: kind })),
  roundBatch: (kind: "resetShards" | "castVotes", size: bigint): Call =>
    market(encodeFunctionData({ abi: marketContract.abi, functionName: kind, args: [size] })),
} as const;
