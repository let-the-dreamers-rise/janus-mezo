// Page-space boxes from the live capture (scripts/capture.mjs -> src/layout.json).
import layout from "./layout.json";

export type State = keyof typeof layout;
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const pageH = (state: State): number => layout[state].pageH;

/** The smallest captured element in `state` whose text matches `pattern` (optionally of `tag`). */
export function box(state: State, pattern: RegExp, tag?: string): Box {
  const hits = layout[state].items
    .filter((i) => pattern.test(i.text) && (!tag || i.tag === tag))
    .sort((a, b) => a.w * a.h - b.w * b.h);
  const hit = hits[0];
  if (!hit) throw new Error(`No box for ${pattern} in ${state}`);
  return { x: hit.x, y: hit.y, w: hit.w, h: hit.h };
}

export const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
export const pad = (b: Box, p: number): Box => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p });
