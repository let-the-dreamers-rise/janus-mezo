import {
  BaseError,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  maxUint256,
  parseEventLogs,
  zeroAddress,
  type Account,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DEPLOYMENT, IS_DEPLOYED } from "@/config/deployment";
import { matsnet } from "@/config/matsnet";
import { MEZO_MATSNET } from "@/config/mezo-addresses";
import { janusVaultAbi } from "@/lib/abi/janus";
import { erc20Abi, votingEscrowAbi } from "@/lib/abi/mezo";
import { gasWithHeadroom } from "@/lib/protocol/keeper/gas";
import { KIT, type Holdings, type KitConfig, type KitItem, type KitKind, type Stock } from "./kit";
import type { KitChain, SendReport, SentItem } from "./service";

/// The least gas each kit call is sent with. Measured on matsnet: a native transfer uses
/// 21k, a MUSD transfer 34k, an approval 26k and a fresh lock 568k. Matsnet's estimates
/// can come back at the bare 21k, and gas costs a few hundred wei, so these floors are cheap.
const GAS_FLOOR: Readonly<Record<KitKind | "approve", bigint>> = {
  gas: 60_000n,
  musd: 100_000n,
  veBtc: 1_200_000n,
  veMezo: 1_200_000n,
  approve: 100_000n,
};
const RECEIPT_TIMEOUT_MS = 40_000;
const PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;

export interface KitClients {
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient<Transport, Chain, Account>;
}

interface Call {
  readonly to: Address;
  readonly data?: Hex;
  readonly value?: bigint;
}

interface Step {
  readonly call: Call;
  readonly gas: bigint;
}

/// One kit item ready to send: an approval first when the escrow needs one, then the call.
interface Prepared {
  readonly item: KitItem;
  readonly steps: readonly Step[];
  /// The escrow that mints the NFT, for the lock items.
  readonly escrow?: Address;
}

type Outcome =
  | { readonly item: KitItem; readonly sent: SentItem }
  | { readonly item: KitItem; readonly error: string };

const shortError = (error: unknown): string =>
  error instanceof BaseError ? error.shortMessage : error instanceof Error ? error.message : String(error);

function mintedTo(receipt: TransactionReceipt, escrow: Address, to: Address): bigint {
  const minted = parseEventLogs({ abi: votingEscrowAbi, eventName: "Transfer", logs: receipt.logs }).find(
    (log) =>
      getAddress(log.address) === getAddress(escrow) && log.args.from === zeroAddress && getAddress(log.args.to) === getAddress(to),
  );
  if (!minted) throw new Error(`No lock was minted to ${to} in ${receipt.transactionHash}`);
  return minted.args.tokenId;
}

/// The faucet wallet as a KitChain: reads balances and signs kits with its own key.
export function kitChain({ publicClient, walletClient }: KitClients, kit: KitConfig = KIT): KitChain {
  const faucet = walletClient.account.address;

  async function readHoldings(address: Address): Promise<Holdings> {
    const [btc, [musd, veBtcCount, veMezoCount, jmezo]] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.multicall({
        allowFailure: false,
        contracts: [
          { address: DEPLOYMENT.musd, abi: erc20Abi, functionName: "balanceOf", args: [address] },
          { address: DEPLOYMENT.veBtc, abi: votingEscrowAbi, functionName: "balanceOf", args: [address] },
          { address: DEPLOYMENT.veMezo, abi: votingEscrowAbi, functionName: "balanceOf", args: [address] },
          { address: DEPLOYMENT.vault, abi: janusVaultAbi, functionName: "balanceOf", args: [address] },
        ],
      }),
    ]);
    return { btc, musd, veBtcCount, veMezoCount, jmezo };
  }

  async function readStock(): Promise<Stock> {
    const [btc, [musd, mezo]] = await Promise.all([
      publicClient.getBalance({ address: faucet }),
      publicClient.multicall({
        allowFailure: false,
        contracts: [
          { address: DEPLOYMENT.musd, abi: erc20Abi, functionName: "balanceOf", args: [faucet] },
          { address: MEZO_MATSNET.mezoToken, abi: erc20Abi, functionName: "balanceOf", args: [faucet] },
        ],
      }),
    ]);
    return { btc, musd, mezo };
  }

  /// Simulates the call through eth_estimateGas, so a revert surfaces with its reason, and
  /// pads the estimate, never going below the call's floor. Matsnet's RPC sometimes drops an
  /// estimate, so a failed one is asked once more before the item is given up.
  async function gasFor(call: Call, floor: bigint): Promise<bigint> {
    const estimate = () => publicClient.estimateGas({ account: faucet, ...call });
    const padded = gasWithHeadroom(await estimate().catch(estimate));
    return padded > floor ? padded : floor;
  }

  const lockCall = (escrow: Address, item: KitItem, duration: bigint, to: Address): Call => ({
    to: escrow,
    data: encodeFunctionData({ abi: votingEscrowAbi, functionName: "createLockFor", args: [item.amount, duration, to] }),
  });

  async function prepareLock(item: KitItem, escrow: Address, token: Address, duration: bigint, to: Address): Promise<Prepared> {
    const call = lockCall(escrow, item, duration, to);
    const allowance = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [faucet, escrow],
    });
    if (allowance >= item.amount) return { item, escrow, steps: [{ call, gas: await gasFor(call, GAS_FLOOR[item.kind]) }] };
    // The lock cannot be simulated before the approval lands, so it goes out at its floor.
    const approve = { to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [escrow, maxUint256] }) };
    return {
      item,
      escrow,
      steps: [
        { call: approve, gas: await gasFor(approve, GAS_FLOOR.approve) },
        { call, gas: GAS_FLOOR[item.kind] },
      ],
    };
  }

  async function prepare(item: KitItem, to: Address): Promise<Prepared> {
    switch (item.kind) {
      case "gas":
        return { item, steps: [{ call: { to, value: item.amount }, gas: GAS_FLOOR.gas }] };
      case "musd": {
        const call = {
          to: DEPLOYMENT.musd,
          data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, item.amount] }),
        };
        return { item, steps: [{ call, gas: await gasFor(call, GAS_FLOOR.musd) }] };
      }
      case "veBtc":
        return prepareLock(item, DEPLOYMENT.veBtc, MEZO_MATSNET.btcToken, kit.veBtcLock, to);
      case "veMezo":
        return prepareLock(item, DEPLOYMENT.veMezo, MEZO_MATSNET.mezoToken, kit.veMezoLock, to);
    }
  }

  /// EIP-1559 fees for the whole batch, or a legacy gas price if the node offers no base fee.
  async function fees(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | { gasPrice: bigint }> {
    try {
      const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();
      return { maxFeePerGas, maxPriorityFeePerGas };
    } catch {
      return { gasPrice: await publicClient.getGasPrice() };
    }
  }

  async function confirm(prepared: Prepared, hashes: readonly Hash[], to: Address): Promise<SentItem> {
    const receipts = await Promise.all(
      hashes.map((hash) => publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS })),
    );
    const reverted = receipts.find((receipt) => receipt.status !== "success");
    if (reverted) throw new Error(`The transaction reverted in ${reverted.transactionHash}`);
    const main = receipts[receipts.length - 1] as TransactionReceipt;
    const tokenId = prepared.escrow ? mintedTo(main, prepared.escrow, to) : undefined;
    return { ...prepared.item, hash: main.transactionHash, ...(tokenId === undefined ? {} : { tokenId }) };
  }

  /// Simulates every item at once, then sends them back to back with consecutive nonces, so
  /// a whole kit usually lands in one block, and waits for the receipts together. Matsnet
  /// takes consecutive nonces from one sender without waiting for each receipt. A send the
  /// node rejects stops the batch there, since a skipped nonce would strand the rest.
  async function send(to: Address, items: readonly KitItem[]): Promise<SendReport> {
    const [prepared, firstNonce, feeParams] = await Promise.all([
      Promise.allSettled(items.map((item) => prepare(item, to))),
      publicClient.getTransactionCount({ address: faucet, blockTag: "pending" }),
      fees(),
    ]);

    let nonce = firstNonce;
    let pending: readonly (Outcome | Promise<Outcome>)[] = [];
    for (const [index, preparation] of prepared.entries()) {
      const item = items[index] as KitItem;
      if (preparation.status === "rejected") {
        pending = [...pending, { item, error: shortError(preparation.reason) }];
        continue;
      }
      let hashes: readonly Hash[] = [];
      try {
        for (const step of preparation.value.steps) {
          const request = { ...step.call, gas: step.gas, nonce, ...feeParams };
          hashes = [...hashes, await walletClient.sendTransaction(request as Parameters<typeof walletClient.sendTransaction>[0])];
          nonce += 1;
        }
      } catch (error) {
        pending = [...pending, { item, error: shortError(error) }];
        break;
      }
      const outcome = confirm(preparation.value, hashes, to).then(
        (sent): Outcome => ({ item, sent }),
        (error: unknown): Outcome => ({ item, error: shortError(error) }),
      );
      pending = [...pending, outcome];
    }

    const outcomes = await Promise.all(pending);
    const sent = outcomes.flatMap((outcome) => ("sent" in outcome ? [outcome.sent] : []));
    const failure = outcomes.find((outcome) => "error" in outcome);
    return failure && "error" in failure ? { sent, failed: { kind: failure.item.kind, message: failure.error } } : { sent };
  }

  return { faucet, readHoldings, readStock, send };
}

/// The faucet chain from the server environment, or null when FAUCET_PRIVATE_KEY is unset
/// or malformed. The key is read here only and never leaves the server.
export function kitChainFromEnv(env: Readonly<Record<string, string | undefined>> = process.env): KitChain | null {
  const key = env.FAUCET_PRIVATE_KEY?.trim();
  if (!IS_DEPLOYED || !key || !PRIVATE_KEY.test(key)) return null;
  const transport = http(env.MEZO_RPC_URL || undefined, { timeout: 15_000, retryCount: 1 });
  const account = privateKeyToAccount(key as Hex);
  return kitChain({
    publicClient: createPublicClient({ chain: matsnet, transport, pollingInterval: 1_000 }),
    walletClient: createWalletClient({ account, chain: matsnet, transport }),
  });
}
