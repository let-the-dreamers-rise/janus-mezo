// Generated from keeper/src/lib/epochs.ts by keeper/scripts/sync-artifacts.ts. Do not edit by hand.
/// Mezo voting epochs, mirroring ProtocolTimeLibrary and NonStakingVoter.vote: epochs are
/// UTC weeks starting on Thursday, and a veNFT may vote strictly after the first hour and
/// no later than one hour before the epoch ends. All values are unix seconds.
export const WEEK = 7n * 24n * 60n * 60n;
export const VOTE_MARGIN = 60n * 60n;

export const epochStart = (timestamp: bigint): bigint => timestamp - (timestamp % WEEK);
export const epochNext = (timestamp: bigint): bigint => epochStart(timestamp) + WEEK;
export const voteStart = (timestamp: bigint): bigint => epochStart(timestamp) + VOTE_MARGIN;
export const voteEnd = (timestamp: bigint): bigint => epochStart(timestamp) + WEEK - VOTE_MARGIN;

export const inVoteWindow = (timestamp: bigint): boolean =>
  timestamp > voteStart(timestamp) && timestamp <= voteEnd(timestamp);

export const nowSeconds = (): bigint => BigInt(Math.floor(Date.now() / 1000));
