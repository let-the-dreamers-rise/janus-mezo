/// Result of one canRelock read in a multicall.
export type RelockRead =
  | { readonly status: "success"; readonly result: boolean }
  | { readonly status: "failure"; readonly error: unknown };

/// Tokens whose canRelock read succeeded and returned true, in their original order.
export function pickRelockable(tokenIds: readonly bigint[], reads: readonly RelockRead[]): bigint[] {
  return tokenIds.filter((_, i) => {
    const read = reads[i];
    return read?.status === "success" && read.result;
  });
}
