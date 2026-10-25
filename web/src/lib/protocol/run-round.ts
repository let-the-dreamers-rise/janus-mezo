import type { Step } from "./round-step";

export interface RoundRunDeps<S> {
  /// A fresh market read; called before every step.
  readonly read: () => Promise<S>;
  readonly plan: (snapshot: S) => Step;
  /// Sends the step; false when it failed or was rejected.
  readonly run: (step: Step, snapshot: S) => Promise<boolean>;
  readonly onStep?: (step: Step, index: number) => void;
  readonly maxSteps?: number;
}

export interface RoundRunResult {
  readonly stopped: "done" | "failed" | "limit";
  readonly ran: number;
  readonly last: Step;
}

/// A round of 100 shards takes at most 10 reset and 10 vote batches plus four single calls.
const DEFAULT_MAX_STEPS = 30;

/// Runs the market forward one call at a time, re-reading it after each, exactly as the
/// keeper's planner decides, until it rests. It never starts a second round in one run.
export async function runRound<S>({ read, plan, run, onStep, maxSteps = DEFAULT_MAX_STEPS }: RoundRunDeps<S>): Promise<RoundRunResult> {
  for (let ran = 0; ; ran++) {
    const snapshot = await read();
    const step = plan(snapshot);
    if (step.kind === "wait" || (step.kind === "startRound" && ran > 0)) return { stopped: "done", ran, last: step };
    if (ran >= maxSteps) return { stopped: "limit", ran, last: step };
    onStep?.(step, ran);
    if (!(await run(step, snapshot))) return { stopped: "failed", ran, last: step };
  }
}
