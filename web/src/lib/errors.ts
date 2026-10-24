import { BaseError, UserRejectedRequestError, decodeErrorResult, isHex, parseAbi, type Hex } from "viem";
import { boostMarketAbi, janusVaultAbi } from "@/lib/abi/janus";

/// Errors Janus users can hit, in the words the app should use. Keys are Solidity error
/// names from BoostMarket, BoostOrders, JanusVault and the tokens they call.
const MESSAGES: Record<string, string> = {
  NotTokenOwner: "You do not own this veBTC NFT.",
  OrderExists: "This veBTC NFT already has a bid. Manage that bid instead.",
  NoBoostGauge: "This veBTC NFT has no boost gauge yet. Create one first.",
  InvalidPrice: "That bid is below the market minimum or above the maximum.",
  InvalidTarget: "Pick a target boost above 1x and no higher than 5x.",
  TooManyOrders: "The order book is full. Try again after a bid closes.",
  UnknownOrder: "That bid no longer exists.",
  NotOrderOwner: "Only the bid's owner can change it.",
  OrderLocked: "This bid is being filled in the open round. Change it after the round closes.",
  NotPrunable: "This bid is still valid, so it cannot be pruned.",
  ZeroAmount: "Enter an amount above zero.",
  RoundInProgress: "A round is already open. Advance it instead.",
  OutsideVoteWindow: "Mezo voting is closed right now. It reopens one hour into the next epoch.",
  NoEligibleShards: "Every shard has already voted this epoch.",
  WrongPhase: "The round moved on. Refresh and try the next step.",
  RoundExpired: "This round's epoch has ended. Close it instead.",
  NoActiveRound: "There is no open round to close.",
  RoundNotComplete: "This round is still voting. It can be closed once voting ends or it times out.",
  FallbackGaugeNotLive: "The market's house gauge is not live, so it cannot settle.",
  TooManyShards: "The vault is full. Try again after a shard is redeemed.",
  UnsupportedEscrow: "Only normal veMEZO locks can join the vault.",
  UnvestedGrant: "This lock is still vesting.",
  EmptyLock: "This lock is empty.",
  LockExpired: "This lock has expired. Extend it on Mezo first.",
  ShardTooSmall: "This lock is below the vault minimum.",
  UnknownShard: "That shard is no longer in the vault.",
  NoShares: "No jMEZO exists yet.",
  ERC20InsufficientBalance: "Your balance is too low for this.",
  ERC20InsufficientAllowance: "Approve MUSD first.",
  ERC721InsufficientApproval: "Approve the NFT transfer first.",
  NotApprovedOrOwner: "You do not own this NFT or have not approved it.",
  AlreadyVotedOrDeposited: "This NFT already voted this epoch.",
};

const EXTRA_ERRORS = parseAbi([
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC721InsufficientApproval(address operator, uint256 tokenId)",
  "error NotApprovedOrOwner()",
  "error AlreadyVotedOrDeposited()",
]);

const ERROR_ABI = [...boostMarketAbi, ...janusVaultAbi, ...EXTRA_ERRORS].filter((item) => item.type === "error");

function revertData(error: BaseError): Hex | undefined {
  let found: Hex | undefined;
  error.walk((cause) => {
    const data = (cause as { data?: unknown }).data;
    if (typeof data === "string" && isHex(data) && data.length >= 10) found = data;
    else if (typeof data === "object" && data !== null) {
      const nested = (data as { data?: unknown }).data;
      if (typeof nested === "string" && isHex(nested) && nested.length >= 10) found = nested;
    }
    return false;
  });
  return found;
}

/// A sentence for a failed simulation or transaction: what went wrong and, where it helps,
/// what to do next. Unknown errors fall back to viem's short message.
export function explainError(error: unknown): string {
  if (error instanceof BaseError) {
    if (error.walk((cause) => cause instanceof UserRejectedRequestError)) {
      return "You rejected the request in your wallet.";
    }
    const data = revertData(error);
    if (data) {
      try {
        const decoded = decodeErrorResult({ abi: ERROR_ABI, data });
        return MESSAGES[decoded.errorName] ?? `The contract rejected this: ${decoded.errorName}.`;
      } catch {
        // Not one of ours; fall through to the generic message.
      }
    }
    if (/user (rejected|denied)/i.test(error.details ?? "")) return "You rejected the request in your wallet.";
    return error.shortMessage;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Try again.";
}
