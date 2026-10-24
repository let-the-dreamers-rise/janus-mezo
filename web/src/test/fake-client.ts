import type { Address, PublicClient } from "viem";

/// A PublicClient stand-in for testing the snapshot readers without a chain. Each contract
/// read is answered by a handler registered for that contract address and function name.
/// A read nobody registered fails loudly; a handler that throws is a reverted call, which
/// multicall reports as a failure when `allowFailure` is on.
export type ReadHandler = (args: readonly unknown[]) => unknown;

export interface FakeRead {
  readonly key: string;
  readonly handler: ReadHandler;
}

interface ContractRead {
  readonly address: Address;
  readonly functionName: string;
  readonly args?: readonly unknown[];
}

export interface FakeChain {
  readonly block: { readonly number: bigint; readonly timestamp: bigint };
  readonly reads: readonly FakeRead[];
  readonly balances?: ReadonlyMap<Address, bigint>;
}

const keyOf = (address: Address, functionName: string): string => `${address.toLowerCase()}.${functionName}`;

export const onRead = (contract: { readonly address: Address }, functionName: string, handler: ReadHandler): FakeRead => ({
  key: keyOf(contract.address, functionName),
  handler,
});

export function fakeClient(chain: FakeChain): PublicClient {
  const handlers = new Map(chain.reads.map((read) => [read.key, read.handler] as const));
  const handlerFor = (read: ContractRead): ReadHandler => {
    const handler = handlers.get(keyOf(read.address, read.functionName));
    if (!handler) throw new Error(`Unexpected read: ${read.functionName} on ${read.address}`);
    return handler;
  };
  const client = {
    getBlock: async () => chain.block,
    getBalance: async ({ address }: { readonly address: Address }) => chain.balances?.get(address) ?? 0n,
    readContract: async (read: ContractRead) => handlerFor(read)(read.args ?? []),
    multicall: async ({ contracts, allowFailure = true }: { readonly contracts: readonly ContractRead[]; readonly allowFailure?: boolean }) =>
      contracts.map((read) => {
        const handler = handlerFor(read);
        if (!allowFailure) return handler(read.args ?? []);
        try {
          return { status: "success", result: handler(read.args ?? []) };
        } catch (error) {
          return { status: "failure", error };
        }
      }),
  };
  return client as unknown as PublicClient;
}
