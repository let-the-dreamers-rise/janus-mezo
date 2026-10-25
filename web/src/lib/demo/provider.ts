import {
  createPublicClient,
  createWalletClient,
  hexToBigInt,
  hexToNumber,
  isAddress,
  isAddressEqual,
  isHex,
  numberToHex,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type Transport,
} from "viem";

/// An EIP-1193 error: 4100 unauthorized, 4200 unsupported method, 4902 unknown chain,
/// -32602 invalid params.
export class DemoProviderError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "DemoProviderError";
  }
}

export interface RequestArguments {
  readonly method: string;
  readonly params?: unknown;
}

export interface DemoProvider {
  request(args: RequestArguments): Promise<unknown>;
}

interface DemoProviderOptions {
  readonly account: LocalAccount;
  readonly chain: Chain;
  readonly transport: Transport;
}

/// The demo wallet signs Janus transactions and nothing else, so it can never be talked
/// into signing a message or permit on someone else's behalf.
const UNSUPPORTED = new Set([
  "personal_sign",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "eth_signTransaction",
]);

const invalid = (message: string) => new DemoProviderError(-32602, message);

function quantity(value: unknown, field: string): bigint | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !isHex(value)) throw invalid(`The transaction's ${field} is not a hex quantity.`);
  return hexToBigInt(value);
}

function readTransaction(params: unknown, self: Address) {
  const [tx] = Array.isArray(params) ? params : [];
  if (typeof tx !== "object" || tx === null) throw invalid("eth_sendTransaction needs a transaction object.");
  const { from, to, data, value, gas } = tx as Readonly<Record<string, unknown>>;
  if (from !== undefined && (typeof from !== "string" || !isAddress(from, { strict: false }) || !isAddressEqual(from, self))) {
    throw new DemoProviderError(4100, "The demo wallet only sends from its own address.");
  }
  if (typeof to !== "string" || !isAddress(to, { strict: false })) {
    throw invalid("The demo wallet only sends to an address, never a contract deployment.");
  }
  if (data !== undefined && (typeof data !== "string" || !isHex(data))) throw invalid("The transaction's data is not hex.");
  return { to: to as Address, data: data as Hex | undefined, value: quantity(value, "value"), gas: quantity(gas, "gas") };
}

/// A browser wallet backed by a local key: it answers account and chain questions itself,
/// signs eth_sendTransaction locally and sends it raw, and passes every read to the RPC.
export function createDemoProvider({ account, chain, transport }: DemoProviderOptions): DemoProvider {
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const forward = publicClient.request as unknown as (args: RequestArguments) => Promise<unknown>;
  const chainId = numberToHex(chain.id);

  async function request({ method, params }: RequestArguments): Promise<unknown> {
    switch (method) {
      case "eth_accounts":
      case "eth_requestAccounts":
        return [account.address];
      case "eth_chainId":
        return chainId;
      case "net_version":
        return String(chain.id);
      case "wallet_switchEthereumChain": {
        const [target] = Array.isArray(params) ? params : [];
        const requested = (target as { readonly chainId?: unknown } | undefined)?.chainId;
        if (typeof requested === "string" && isHex(requested) && hexToNumber(requested) === chain.id) return null;
        throw new DemoProviderError(4902, `The demo wallet only works on ${chain.name}.`);
      }
      case "eth_sendTransaction": {
        const tx = readTransaction(params, account.address);
        return walletClient.sendTransaction({ to: tx.to, data: tx.data, value: tx.value, gas: tx.gas });
      }
      default:
        if (UNSUPPORTED.has(method)) throw new DemoProviderError(4200, `The demo wallet does not support ${method}.`);
        return forward({ method, params });
    }
  }

  return { request };
}
