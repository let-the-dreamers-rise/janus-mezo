// The one timeline. Every shot starts with its narration line: duration = lead-in + the line's
// spoken length (edge-tts word timings) + a breath. Captions, SFX and seams derive from SHOTS.
import timings from "./timings.json";

export const FPS = 30;

export type BeatId = "hook" | "problem" | "insight" | "janus" | "start" | "boost" | "market" | "earn" | "trust" | "close";
export type SeamKind = "fade" | "focus" | "tunnel" | "whip" | "flash";

interface Plan {
  readonly id: BeatId;
  /** Frames before the voice starts. */
  readonly pre: number;
  /** Frames after the voice ends. */
  readonly post: number;
  /** How this shot hands over to the next one. */
  readonly out?: SeamKind;
  readonly captions: boolean;
}

const PLAN: readonly Plan[] = [
  { id: "hook", pre: 40, post: 26, out: "fade", captions: false },
  { id: "problem", pre: 12, post: 18, out: "focus", captions: true },
  { id: "insight", pre: 12, post: 24, out: "focus", captions: true },
  { id: "janus", pre: 12, post: 24, out: "tunnel", captions: true },
  { id: "start", pre: 14, post: 18, out: "flash", captions: true },
  { id: "boost", pre: 12, post: 22, out: "whip", captions: true },
  { id: "market", pre: 12, post: 22, out: "focus", captions: true },
  { id: "earn", pre: 12, post: 18, out: "flash", captions: true },
  { id: "trust", pre: 12, post: 18, out: "tunnel", captions: true },
  { id: "close", pre: 16, post: 84, captions: false },
];

export interface Word {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export interface Shot extends Plan {
  readonly index: number;
  readonly from: number;
  readonly dur: number;
  /** Seam this shot enters with (the previous shot's `out`). */
  readonly in?: SeamKind;
  readonly words: readonly Word[];
}

const wordsOf = (id: BeatId): readonly Word[] => {
  const beat = (timings as { id: string; words: Word[] }[]).find((b) => b.id === id);
  if (!beat) throw new Error(`No narration timings for ${id}`);
  return beat.words;
};

const build = (): readonly Shot[] => {
  let from = 0;
  return PLAN.map((plan, index) => {
    const words = wordsOf(plan.id);
    const spoken = Math.ceil((words[words.length - 1]?.end ?? 0) * FPS);
    const shot: Shot = { ...plan, index, from, dur: plan.pre + spoken + plan.post, in: PLAN[index - 1]?.out, words };
    from += shot.dur;
    return shot;
  });
};

export const SHOTS = build();
export const TOTAL = SHOTS.reduce((n, s) => n + s.dur, 0);
export const shot = (id: BeatId): Shot => SHOTS.find((s) => s.id === id) as Shot;

/** Local frame (from the shot start) at which word `text` (its `nth` occurrence) is spoken. */
export const wordF = (id: BeatId, text: string, nth = 0): number => {
  const s = shot(id);
  const hits = s.words.filter((w) => w.text.toLowerCase() === text.toLowerCase());
  const w = hits[nth];
  if (!w) throw new Error(`Word "${text}" #${nth} not in ${id}`);
  return s.pre + Math.round(w.start * FPS);
};
