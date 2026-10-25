// Page-space cursor (cursor-flyover + input-trigger-moves A): arcs between targets with a
// small wrist overshoot, dips on click and leaves a bronze ripple. Counter-scaled by the
// camera zoom so it reads as one constant-size UI layer.
import React from "react";
import { C, EASE, bronze, prog, ramp } from "../theme";

export interface CursorKey {
  readonly f: number;
  readonly x: number;
  readonly y: number;
}

const ARRIVE = (t: number) => {
  // out-cubic to 1.04, then settle back: the "wrist flick" on arrival
  if (t < 0.82) return 1.04 * (1 - Math.pow(1 - t / 0.82, 3));
  return 1.04 - 0.04 * EASE.inOut((t - 0.82) / 0.18);
};

export function cursorAt(keys: readonly CursorKey[], f: number, travel = 22): { x: number; y: number } {
  const first = keys[0] as CursorKey;
  if (f <= first.f) return first;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i] as CursorKey;
    const a = keys[i - 1] as CursorKey;
    if (f < b.f) {
      const start = Math.max(a.f, b.f - travel);
      if (f <= start) return a;
      const t = ARRIVE((f - start) / (b.f - start));
      // arc: perpendicular offset that peaks mid-flight
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const bow = Math.sin(Math.PI * Math.min(1, t)) * 0.12;
      return { x: a.x + dx * t - dy * bow, y: a.y + dy * t + dx * bow };
    }
  }
  return keys[keys.length - 1] as CursorKey;
}

export const Cursor: React.FC<{
  readonly f: number;
  readonly keys: readonly CursorKey[];
  readonly clicks: readonly number[];
  readonly zoom: number;
  readonly appear?: number;
  readonly hide?: number;
}> = ({ f, keys, clicks, zoom, appear = 0, hide = Infinity }) => {
  const { x, y } = cursorAt(keys, f);
  const vis = Math.min(prog(f, appear, appear + 8), 1 - prog(f, hide, hide + 8));
  if (vis <= 0) return null;
  const k = 1 / zoom;
  const dip = clicks.reduce((d, c) => Math.max(d, ramp(f, [c, c + 2, c + 6], [0, 1, 0])), 0);
  return (
    <>
      {clicks.map((c) => {
        if (f < c || f > c + 26) return null;
        const p = keys.length ? cursorAt(keys, c) : { x, y };
        const d = ramp(f, [c, c + 22], [18, 120], EASE.out) * k;
        const o = ramp(f, [c, c + 26], [0.9, 0]);
        return (
          <div
            key={c}
            style={{
              position: "absolute",
              left: p.x - d / 2,
              top: p.y - d / 2,
              width: d,
              height: d,
              borderRadius: "50%",
              border: `${ramp(f, [c, c + 22], [5, 2]) * k}px solid ${C.bronze}`,
              boxShadow: `0 0 ${14 * k}px ${bronze(0.5)}`,
              opacity: o,
              pointerEvents: "none",
            }}
          />
        );
      })}
      <svg
        width={34 * k}
        height={34 * k}
        viewBox="0 0 28 28"
        style={{
          position: "absolute",
          left: x - 2.4 * k,
          top: y - 1.2 * k + dip * 3 * k,
          opacity: vis,
          filter: `drop-shadow(0 ${4 * k}px ${7 * k}px rgba(0,0,0,0.55))`,
          transform: `scale(${1 - dip * 0.08})`,
          transformOrigin: "0 0",
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <path d="M2 1 L2 23 L8 17.5 L11.5 25 L15.5 23.2 L12 15.8 L20 15 Z" fill="#fbf7ef" stroke="#1a1612" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </>
  );
};
