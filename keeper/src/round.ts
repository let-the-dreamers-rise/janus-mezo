import { encodeFunctionData, type Address, type Hex } from "viem";
import { boostMarketAbi } from "./abi/janus.js";
import { boostVoterAbi } from "./abi/mezo.js";
import { boostCandidates, readBoosts } from "./chain/boosts.js";
import {
  chainTime,
  demandingOrders,
  readRound,
  readRoundTimeout,
  shardSignals,
  type JanusContracts,
} from "./chain/signals.js";
import { sendTx, type Signer } from "./chain/tx.js";
import { chunks, fitBatch } from "./lib/batch.js";
import { staleBoosts } from "./lib/boosts.js";
import { PHASE, PHASE_NAMES, nextAction, type Action } from "./lib/planner.js";

export type { Logger } from "./chain/tx.js";

/// pokeBoosts measured 203k gas per NFT in a batch on matsnet, 413k for a cold one.
const POKE_BATCH = 16;

export interface Keeper extends Signer {
  readonly contracts: JanusContracts;
  /// Largest number of shards one resetShards or castVotes transaction may handle.
  readonly batchSize: bigint;
  /// Gas a single transaction may use; batches shrink until their estimate fits.
  readonly gasBudget: bigint;
}

export interface Decision {
  readonly action: Action;
  readonly roundId: bigint;
  readonly phase: string;
}

export async function decide(keeper: Keeper): Promise<Decision> {
  const { publicClient: client, contracts } = keeper;
  const [now, latest, roundTimeout] = await Promise.all([
    chainTime(client),
    readRound(client, contracts),
    readRoundTimeout(client, contracts),
  ]);
  const { id, round } = latest;
  const idle = round.phase === PHASE.Idle;
  const [shards, demand] = idle
    ? await Promise.all([shardSignals(client, contracts, now, latest), demandingOrders(client, contracts)])
    : [{ eligible: true, stale: false }, []];
  const action = nextAction(round, now, {
    hasEligibleShards: shards.eligible,
    hasStaleVotes: shards.stale,
    hasDemand: idle ? demand.length > 0 : true,
    roundTimeout,
  });
  return { action, roundId: id, phase: PHASE_NAMES[round.phase] ?? `phase ${round.phase}` };
}

function encodeStep(kind: "startRound" | "settle" | "finalize"): Hex {
  return encodeFunctionData({ abi: boostMarketAbi, functionName: kind });
}

function encodeBatch(kind: "resetShards" | "castVotes", size: bigint): Hex {
  return encodeFunctionData({ abi: boostMarketAbi, functionName: kind, args: [size] });
}

async function estimate(keeper: Keeper, to: Address, data: Hex): Promise<bigint | null> {
  try {
    return await keeper.publicClient.estimateGas({ account: keeper.walletClient.account, to, data });
  } catch {
    return null;
  }
}

/// Sends resetShards or castVotes with the largest batch whose gas fits the budget. If no
/// size fits, a batch of one is sent anyway so the revert reason reaches the log.
async function sendBatch(keeper: Keeper, kind: "resetShards" | "castVotes"): Promise<void> {
  const market = keeper.contracts.market;
  const fit = await fitBatch(keeper.batchSize, keeper.gasBudget, (size) =>
    estimate(keeper, market, encodeBatch(kind, size)),
  );
  const size = fit?.size ?? 1n;
  await sendTx(keeper, `${kind}(${size})`, market, encodeBatch(kind, size));
}

async function act(keeper: Keeper, action: Action): Promise<void> {
  switch (action.kind) {
    case "resetShards":
    case "castVotes":
      return sendBatch(keeper, action.kind);
    case "startRound":
    case "settle":
    case "finalize":
      await sendTx(keeper, action.kind, keeper.contracts.market, encodeStep(action.kind));
      return;
    case "wait":
      return;
  }
}

/// Pokes a group of NFTs in one pokeBoosts call. pokeBoosts is all-or-nothing, so a group
/// that would revert or not fit is split in half; a single NFT that still fails is skipped.
async function pokeGroup(keeper: Keeper, tokenIds: readonly bigint[]): Promise<number> {
  const voter = keeper.contracts.boostVoter;
  const data = encodeFunctionData({ abi: boostVoterAbi, functionName: "pokeBoosts", args: [[...tokenIds]] });
  const gas = await estimate(keeper, voter, data);
  if (gas !== null && gas <= keeper.gasBudget) {
    await sendTx(keeper, `pokeBoosts(${tokenIds.length})`, voter, data);
    return tokenIds.length;
  }
  if (tokenIds.length === 1) {
    keeper.log("poke.skipped", { tokenId: tokenIds[0] });
    return 0;
  }
  const half = Math.ceil(tokenIds.length / 2);
  const first = await pokeGroup(keeper, tokenIds.slice(0, half));
  return first + (await pokeGroup(keeper, tokenIds.slice(half)));
}

/// Applies the live boost to every Janus NFT whose applied boost is out of date: this
/// round's buyers gain the boost they paid for, and earlier buyers lose boost nobody pays
/// for anymore. Runs only while no round is open, when gauge weights are final.
export async function applyBoosts(keeper: Keeper, latestRoundId: bigint): Promise<number> {
  const { publicClient: client, contracts } = keeper;
  const candidates = await boostCandidates(client, contracts, latestRoundId);
  const stale = staleBoosts(await readBoosts(client, contracts, candidates));
  if (stale.length === 0) return 0;
  keeper.log("boosts.stale", { tokenIds: stale });
  let applied = 0;
  for (const group of chunks(stale, POKE_BATCH)) applied += await pokeGroup(keeper, group);
  return applied;
}

/// Advances the market until it has to wait, then brings boosts up to date.
export async function drive(keeper: Keeper, maxSteps = 60): Promise<Action> {
  for (let step = 0; step < maxSteps; step++) {
    const decision = await decide(keeper);
    keeper.log("decide", { roundId: decision.roundId, phase: decision.phase, action: decision.action });
    if (decision.action.kind === "wait") {
      if (decision.phase === PHASE_NAMES[PHASE.Idle]) {
        const poked = await applyBoosts(keeper, decision.roundId);
        if (poked > 0) keeper.log("boosts.applied", { count: poked });
      }
      return decision.action;
    }
    await act(keeper, decision.action);
  }
  throw new Error(`market did not reach a resting state within ${maxSteps} steps`);
}
