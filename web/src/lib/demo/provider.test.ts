import { custom, parseTransaction, recoverTransactionAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { matsnet } from "@/config/matsnet";
import { createDemoProvider, DemoProviderError } from "./provider";

const KEY: Hex = `0x${"3c".repeat(32)}`;
const account = privateKeyToAccount(KEY);
const TARGET = "0x9098b6f514f322A6f57501cdd92e7aBf79E41870";

const BLOCK = {
  number: "0x10",
  hash: `0x${"aa".repeat(32)}`,
  parentHash: `0x${"bb".repeat(32)}`,
  timestamp: "0x6720f000",
  baseFeePerGas: "0x64",
  gasLimit: "0x989680",
  gasUsed: "0x0",
  transactions: [],
};

function rpc() {
  const raws: Hex[] = [];
  const forwarded: string[] = [];
  const transport = custom({
    async request({ method, params }: { method: string; params?: unknown }) {
      forwarded.push(method);
      switch (method) {
        case "eth_chainId":
          return "0x7b7b";
        case "eth_getTransactionCount":
          return "0x3";
        case "eth_getBlockByNumber":
          return BLOCK;
        case "eth_maxPriorityFeePerGas":
          return "0x1";
        case "eth_estimateGas":
          return "0x5208";
        case "eth_blockNumber":
          return "0x10";
        case "eth_sendRawTransaction":
          raws.push((params as [Hex])[0]);
          return `0x${"cd".repeat(32)}`;
        default:
          throw new Error(`unexpected ${method}`);
      }
    },
  });
  return { transport, raws, forwarded };
}

const providerWith = (transport: ReturnType<typeof rpc>["transport"]) =>
  createDemoProvider({ account, chain: matsnet, transport });

describe("demo provider", () => {
  it("answers account and chain questions itself", async () => {
    const { transport, forwarded } = rpc();
    const provider = providerWith(transport);
    expect(await provider.request({ method: "eth_requestAccounts" })).toEqual([account.address]);
    expect(await provider.request({ method: "eth_accounts" })).toEqual([account.address]);
    expect(await provider.request({ method: "eth_chainId" })).toBe("0x7b7b");
    expect(await provider.request({ method: "net_version" })).toBe("31611");
    expect(forwarded).toEqual([]);
  });

  it("stays on Mezo Matsnet", async () => {
    const provider = providerWith(rpc().transport);
    expect(await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7b7b" }] })).toBeNull();
    await expect(
      provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] }),
    ).rejects.toMatchObject({ code: 4902 });
  });

  it("signs a transaction with its own key and sends it raw", async () => {
    const { transport, raws } = rpc();
    const provider = providerWith(transport);
    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: account.address.toLowerCase(), to: TARGET, data: "0xabcdef01", value: "0x2", gas: "0x30d40" }],
    });
    expect(hash).toBe(`0x${"cd".repeat(32)}`);
    expect(raws).toHaveLength(1);
    const raw = raws[0] as Hex;
    expect(await recoverTransactionAddress({ serializedTransaction: raw as never })).toBe(account.address);
    expect(parseTransaction(raw)).toMatchObject({
      chainId: 31611,
      to: TARGET.toLowerCase(),
      data: "0xabcdef01",
      value: 2n,
      gas: 200_000n,
      nonce: 3,
    });
  });

  it("estimates gas when the caller leaves it out", async () => {
    const { transport, raws } = rpc();
    await providerWith(transport).request({ method: "eth_sendTransaction", params: [{ to: TARGET, data: "0x" }] });
    expect(parseTransaction(raws[0] as Hex).gas).toBe(21_000n);
  });

  it("refuses to send from any other address", async () => {
    const provider = providerWith(rpc().transport);
    await expect(
      provider.request({ method: "eth_sendTransaction", params: [{ from: TARGET, to: TARGET }] }),
    ).rejects.toMatchObject({ code: 4100 });
  });

  it("refuses malformed transactions and contract deployments", async () => {
    const provider = providerWith(rpc().transport);
    await expect(provider.request({ method: "eth_sendTransaction", params: [] })).rejects.toBeInstanceOf(DemoProviderError);
    await expect(
      provider.request({ method: "eth_sendTransaction", params: [{ data: "0x6080" }] }),
    ).rejects.toMatchObject({ code: -32602 });
    await expect(
      provider.request({ method: "eth_sendTransaction", params: [{ to: TARGET, value: "twelve" }] }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it("does not sign messages or typed data", async () => {
    const provider = providerWith(rpc().transport);
    for (const method of ["personal_sign", "eth_sign", "eth_signTypedData_v4", "eth_signTransaction"]) {
      await expect(provider.request({ method, params: [] })).rejects.toMatchObject({ code: 4200 });
    }
  });

  it("passes chain reads through to the RPC", async () => {
    const { transport, forwarded } = rpc();
    expect(await providerWith(transport).request({ method: "eth_blockNumber" })).toBe("0x10");
    expect(forwarded).toEqual(["eth_blockNumber"]);
  });
});
