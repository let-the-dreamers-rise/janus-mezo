import { epochNext, inVoteWindow, voteEnd, voteStart } from "./keeper/epochs";
import { formatDuration } from "@/lib/time";

export interface VoteWindow {
  readonly open: boolean;
  /// Seconds until the window closes when open, or until it next opens when closed.
  readonly secondsLeft: bigint;
  readonly label: string;
}

/// When voting next opens: this epoch's window if it has not opened yet, else the next epoch's.
const nextVoteStart = (now: bigint): bigint => (now <= voteStart(now) ? voteStart(now) : voteStart(epochNext(now)));

/// Mezo's vote window opens one hour into each weekly epoch and closes one hour before it ends.
export function voteWindow(now: bigint): VoteWindow {
  if (inVoteWindow(now)) {
    const left = voteEnd(now) - now;
    return { open: true, secondsLeft: left, label: `Voting closes in ${formatDuration(left)}` };
  }
  const left = nextVoteStart(now) - now;
  return { open: false, secondsLeft: left, label: `Voting opens in ${formatDuration(left)}` };
}

/// For a market whose shards have all voted: the next round can start when voting next opens.
export const nextRoundLabel = (now: bigint): string => `Next round in ${formatDuration(nextVoteStart(now) - now)}`;
