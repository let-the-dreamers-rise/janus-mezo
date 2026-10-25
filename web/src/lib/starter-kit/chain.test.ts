import {
  decodeFunctionData,
  encodeEventTopics,
  maxUint256,
  zeroAddress,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { DEPLOYMENT } from "@/config/deployment";
import { MEZO_MATSNET } from "@/config/mezo-addresses";
import { erc20Abi, votingEscrowAbi } from "@/lib/abi/mezo";
import { MAX_TX_GAS } from "@/lib/protocol/keeper/gas";
import { kitChain, kitChainFromEnv, type KitClients } from "./chain";
import { KIT, type KitItem } from "./kit";

const FAUCET: Address = "0x1B2A0915b893B79fE1019a9Dcf141c3669C3D569";
const JUDGE: Address = "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C";
const WAD = 10n ** 18n;

interface SentTx {
  readonly to: Address;
  readonly data?: Hex;
  readonly value?: bigint;
  readonly gas: bigint;
  readonly nonce: number;
  readonly maxFeePerGas?: bigint;
}

interface FakeOptions {
  readonly allowance?: bigint;
  /// What eth_estimateGas answers; matsnet sometimes answers far too low.
  readonly estimate?: bigint;
  /// Calls whose simulation reverts.
  readonly revertOn?: (call: { readonly to: Address; readonly data?: Hex }) => boolean;
  /// Sends that the RPC rejects, by send index.
  readonly rejectSend?: ReadonlySet<number>;
  /// Sends that are mined but revert, by send index.
  readonly revertMined?: ReadonlySet<number>;
}

const hashOf = (n: number): Hash => `0x${n.toString(16).padStart(64, "0")}`;

function mintLog(escrow: Address, to: Address, tokenId: bigint) {
  return {
    address: escrow,
    topics: encodeEventTopics({ abi: votingEscrowAbi, eventName: "Transfer", args: { from: zeroAddress, to, tokenId } }),
    data: "0x" as Hex,
    blockNumber: 1n,
    blockHash: hashOf(999),
    transactionHash: hashOf(1),
    transactionIndex: 0,
    logIndex: 0,
    removed: false,
  };
}

function fakeClients({
  allowance = maxUint256,
  estimate = 100_000n,
  revertOn,
  rejectSend = new Set(),
  revertMined = new Set(),
}: FakeOptions = {}) {
  const sent: SentTx[] = [];
  const receipts = new Map<Hash, TransactionReceipt>();
  let nextTokenId = 2_000n;
  const balances = new Map<string, bigint>([
    [JUDGE.toLowerCase(), 3n * 10n ** 10n],
    [FAUCET.toLowerCase(), 10n ** 16n],
  ]);

  const publicClient = {
    getBalance: async ({ address }: { address: Address }) => balances.get(address.toLowerCase()) ?? 0n,
    multicall: async ({ contracts }: { contracts: readonly { address: Address; functionName: string; args: readonly [Address] }[] }) =>
      contracts.map(({ address, args }) => {
        const holder = args[0].toLowerCase();
        if (address === DEPLOYMENT.musd) return holder === FAUCET.toLowerCase() ? 200n * WAD : WAD / 2n;
        if (address === MEZO_MATSNET.mezoToken) return 40n * WAD;
        if (address === DEPLOYMENT.veBtc) return 1n;
        if (address === DEPLOYMENT.veMezo) return 0n;
        if (address === DEPLOYMENT.vault) return 7n * WAD;
        throw new Error(`unexpected read on ${address}`);
      }),
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName !== "allowance") throw new Error(`unexpected read ${functionName}`);
      return allowance;
    },
    estimateGas: async (call: { to: Address; data?: Hex }) => {
      if (revertOn?.(call)) throw new Error("execution reverted: LockDurationTooLong");
      return estimate;
    },
    getTransactionCount: async () => 40,
    estimateFeesPerGas: async () => ({ maxFeePerGas: 500n, maxPriorityFeePerGas: 1n }),
    waitForTransactionReceipt: async ({ hash }: { hash: Hash }) => {
      const receipt = receipts.get(hash);
      if (!receipt) throw new Error("unknown hash");
      return receipt;
    },
  };

  const walletClient = {
    account: { address: FAUCET },
    sendTransaction: async (tx: SentTx) => {
      const index = sent.length;
      if (rejectSend.has(index)) throw new Error("invalid nonce");
      sent.push(tx);
      const hash = hashOf(index + 1);
      const reverted = revertMined.has(index);
      const logs =
        !reverted && tx.data && (tx.to === DEPLOYMENT.veBtc || tx.to === DEPLOYMENT.veMezo)
          ? [mintLog(tx.to, JUDGE, nextTokenId++)]
          : [];
      receipts.set(hash, {
        status: reverted ? "reverted" : "success",
        gasUsed: 50_000n,
        transactionHash: hash,
        logs,
      } as unknown as TransactionReceipt);
      return hash;
    },
  };

  const clients = { publicClient, walletClient } as unknown as KitClients;
  return { clients, sent };
}

const FULL: readonly KitItem[] = [
  { kind: "gas", amount: KIT.gas },
  { kind: "musd", amount: KIT.musd },
  { kind: "veBtc", amount: KIT.veBtc },
  { kind: "veMezo", amount: KIT.veMezo },
];

describe("kitChain reads", () => {
  it("reads what a wallet holds", async () => {
    const chain = kitChain(fakeClients().clients);
    expect(await chain.readHoldings(JUDGE)).toEqual({
      btc: 3n * 10n ** 10n,
      musd: WAD / 2n,
      veBtcCount: 1n,
      veMezoCount: 0n,
      jmezo: 7n * WAD,
    });
  });

  it("reads the faucet's stock", async () => {
    const chain = kitChain(fakeClients().clients);
    expect(chain.faucet).toBe(FAUCET);
    expect(await chain.readStock()).toEqual({ btc: 10n ** 16n, musd: 200n * WAD, mezo: 40n * WAD });
  });
});

describe("kitChain send", () => {
  it("sends gas, MUSD and both locks back to back and returns the minted NFTs", async () => {
    const fake = fakeClients();
    const report = await kitChain(fake.clients).send(JUDGE, FULL);

    expect(report.failed).toBeUndefined();
    expect(report.sent.map((item) => [item.kind, item.tokenId])).toEqual([
      ["gas", undefined],
      ["musd", undefined],
      ["veBtc", 2_000n],
      ["veMezo", 2_001n],
    ]);
    expect(fake.sent.map((tx) => tx.nonce)).toEqual([40, 41, 42, 43]);
    expect(fake.sent.every((tx) => tx.maxFeePerGas === 500n)).toBe(true);

    const [gas, musd, veBtc, veMezo] = fake.sent;
    expect(gas).toMatchObject({ to: JUDGE, value: KIT.gas, gas: 60_000n });
    expect(musd?.to).toBe(DEPLOYMENT.musd);
    expect(decodeFunctionData({ abi: erc20Abi, data: musd?.data ?? "0x" }).args).toEqual([JUDGE, KIT.musd]);
    expect(veBtc?.to).toBe(DEPLOYMENT.veBtc);
    expect(decodeFunctionData({ abi: votingEscrowAbi, data: veBtc?.data ?? "0x" })).toMatchObject({
      functionName: "createLockFor",
      args: [KIT.veBtc, KIT.veBtcLock, JUDGE],
    });
    expect(decodeFunctionData({ abi: votingEscrowAbi, data: veMezo?.data ?? "0x" }).args).toEqual([
      KIT.veMezo,
      KIT.veMezoLock,
      JUDGE,
    ]);
  });

  it("pads matsnet's gas estimate by half", async () => {
    const fake = fakeClients({ estimate: 2_000_000n });
    await kitChain(fake.clients).send(JUDGE, [{ kind: "veBtc", amount: KIT.veBtc }]);
    expect(fake.sent[0]?.gas).toBe(3_000_000n);
  });

  it("never sends with less than the measured need when the estimate comes back low", async () => {
    const fake = fakeClients({ estimate: 21_064n });
    await kitChain(fake.clients).send(JUDGE, FULL);
    expect(fake.sent.map((tx) => tx.gas)).toEqual([60_000n, 100_000n, 1_200_000n, 1_200_000n]);
  });

  it("caps the gas limit to fit a block", async () => {
    const fake = fakeClients({ estimate: 9_000_000n });
    await kitChain(fake.clients).send(JUDGE, [{ kind: "musd", amount: WAD }]);
    expect(fake.sent[0]?.gas).toBe(MAX_TX_GAS);
  });

  it("approves the escrow first when its allowance runs short", async () => {
    const fake = fakeClients({ allowance: 0n });
    const report = await kitChain(fake.clients).send(JUDGE, [{ kind: "veMezo", amount: KIT.veMezo }]);
    expect(report.sent.map((item) => item.kind)).toEqual(["veMezo"]);
    expect(fake.sent.map((tx) => [tx.to, tx.nonce])).toEqual([
      [MEZO_MATSNET.mezoToken, 40],
      [DEPLOYMENT.veMezo, 41],
    ]);
    expect(decodeFunctionData({ abi: erc20Abi, data: fake.sent[0]?.data ?? "0x" })).toMatchObject({
      functionName: "approve",
      args: [DEPLOYMENT.veMezo, maxUint256],
    });
    expect(fake.sent[1]?.gas).toBe(1_200_000n);
  });

  it("skips an item whose simulation reverts and still sends the rest", async () => {
    const fake = fakeClients({ revertOn: (call) => call.to === DEPLOYMENT.veBtc });
    const report = await kitChain(fake.clients).send(JUDGE, FULL);
    expect(report.sent.map((item) => item.kind)).toEqual(["gas", "musd", "veMezo"]);
    expect(report.failed?.kind).toBe("veBtc");
    expect(report.failed?.message).toContain("LockDurationTooLong");
    expect(fake.sent.map((tx) => tx.nonce)).toEqual([40, 41, 42]);
  });

  it("stops sending when the RPC rejects a transaction, so no nonce is skipped", async () => {
    const fake = fakeClients({ rejectSend: new Set([1]) });
    const report = await kitChain(fake.clients).send(JUDGE, FULL);
    expect(report.sent.map((item) => item.kind)).toEqual(["gas"]);
    expect(report.failed).toEqual({ kind: "musd", message: "invalid nonce" });
    expect(fake.sent).toHaveLength(1);
  });

  it("reports a transaction that was mined but reverted", async () => {
    const fake = fakeClients({ revertMined: new Set([2]) });
    const report = await kitChain(fake.clients).send(JUDGE, FULL);
    expect(report.sent.map((item) => item.kind)).toEqual(["gas", "musd", "veMezo"]);
    expect(report.failed?.kind).toBe("veBtc");
  });

  it("fails an item whose lock receipt has no mint for the wallet", async () => {
    const fake = fakeClients();
    const report = await kitChain(fake.clients).send(FAUCET, [{ kind: "veBtc", amount: KIT.veBtc }]);
    expect(report.failed?.kind).toBe("veBtc");
  });
});

describe("kitChainFromEnv", () => {
  it("stays off without a well-formed faucet key", () => {
    expect(kitChainFromEnv({})).toBeNull();
    expect(kitChainFromEnv({ FAUCET_PRIVATE_KEY: "0x1234" })).toBeNull();
  });

  it("builds a chain that signs as the faucet key's address", () => {
    const key: Hex = `0x${"11".repeat(32)}`;
    const chain = kitChainFromEnv({ FAUCET_PRIVATE_KEY: key });
    expect(chain?.faucet).toBe(privateKeyToAccount(key).address);
  });

  it("ignores whitespace a host may store around the key", () => {
    const key: Hex = `0x${"22".repeat(32)}`;
    const chain = kitChainFromEnv({ FAUCET_PRIVATE_KEY: ` ${key}\r\n` });
    expect(chain?.faucet).toBe(privateKeyToAccount(key).address);
  });
});
