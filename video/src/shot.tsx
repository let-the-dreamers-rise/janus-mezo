// Shot plumbing: each shot renders PAD frames before and after its slot so seams can overlap,
// and the Seam wrapper applies the hand-over chosen in the timeline (shot-transitions card:
// A flash, B tunnel, C focus, D fade, E whip).
import React, { createContext, useContext } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import type { SeamKind, Shot } from "./timeline";
import { EASE, prog } from "./theme";
import { Easing } from "remotion";

export const PAD = 16;
const ShotContext = createContext<Shot | null>(null);

/** The current shot and its local frame (0 = the shot's first frame). */
export function useShot(): Shot & { readonly f: number } {
  const shot = useContext(ShotContext);
  if (!shot) throw new Error("useShot outside a ShotSequence");
  return { ...shot, f: useCurrentFrame() - PAD };
}

const WHIP = Easing.bezier(0.6, 0, 0.4, 1);
const SWING = 2400;

interface Look {
  readonly opacity: number;
  readonly blur: number;
  readonly hblur: number;
  readonly x: number;
  readonly scale: number;
}

const NONE: Look = { opacity: 1, blur: 0, hblur: 0, x: 0, scale: 1 };

/** Window of frames (relative to the seam) a seam kind occupies on each side. */
export const seamWindow = (kind: SeamKind | undefined, side: "in" | "out"): readonly [number, number] => {
  switch (kind) {
    case "fade":
      return side === "in" ? [0, 10] : [-10, 0];
    case "focus":
      return side === "in" ? [-8, 10] : [-10, 8];
    case "tunnel":
      return side === "in" ? [0, 14] : [-12, 0];
    case "whip":
      return [-4, 4];
    default:
      return [0, 0];
  }
};

function inLook(kind: SeamKind | undefined, f: number): Look {
  const [a, b] = seamWindow(kind, "in");
  switch (kind) {
    case "fade": {
      const p = prog(f, a, b, EASE.inOut);
      return { ...NONE, opacity: p };
    }
    case "focus": {
      const p = prog(f, a, b, Easing.bezier(0.3, 0, 0.2, 1));
      return { ...NONE, opacity: p, blur: (1 - p) * 8, x: (1 - p) * 50 };
    }
    case "tunnel": {
      const p = prog(f, a, b, Easing.bezier(0.3, 0, 0.2, 1));
      return { ...NONE, opacity: p, blur: (1 - p) * 12, scale: 0.6 + 0.4 * p };
    }
    case "whip": {
      const p = prog(f, a, b, WHIP);
      return { ...NONE, x: (1 - p) * SWING, hblur: Math.sin(Math.PI * p) * 70 };
    }
    default:
      return NONE;
  }
}

function outLook(kind: SeamKind | undefined, f: number, dur: number): Look {
  const [a, b] = seamWindow(kind, "out");
  switch (kind) {
    case "fade": {
      const q = prog(f, dur + a, dur + b, EASE.inOut);
      return { ...NONE, opacity: 1 - q };
    }
    case "focus": {
      const q = prog(f, dur + a, dur + b, Easing.bezier(0.45, 0, 0.3, 1));
      return { ...NONE, opacity: 1 - q, blur: q * 8, x: -q * 60 };
    }
    case "tunnel": {
      const q = prog(f, dur + a, dur + b, Easing.bezier(0.45, 0, 0.2, 1));
      return { ...NONE, opacity: 1 - q, blur: q * 6, scale: 1 + 0.4 * q };
    }
    case "whip": {
      const q = prog(f, dur + a, dur + b, WHIP);
      return { ...NONE, x: -q * SWING, hblur: Math.sin(Math.PI * q) * 70 };
    }
    default:
      return NONE;
  }
}

const Seam: React.FC<{ readonly shot: Shot; readonly children: React.ReactNode }> = ({ shot, children }) => {
  const f = useCurrentFrame() - PAD;
  const first = seamWindow(shot.in, "in")[0];
  const last = shot.dur + seamWindow(shot.out, "out")[1];
  if (f < first || f >= last) return null;
  const i = f < shot.dur / 2 ? inLook(shot.in, f) : NONE;
  const o = f >= shot.dur / 2 ? outLook(shot.out, f, shot.dur) : NONE;
  const look: Look = {
    opacity: i.opacity * o.opacity,
    blur: i.blur + o.blur,
    hblur: i.hblur + o.hblur,
    x: i.x + o.x,
    scale: i.scale * o.scale,
  };
  const filterId = `whip-${shot.index}`;
  const filters = [look.blur > 0.05 ? `blur(${look.blur}px)` : "", look.hblur > 0.5 ? `url(#${filterId})` : ""].filter(Boolean);
  return (
    <AbsoluteFill
      style={{
        opacity: look.opacity,
        transform: `translateX(${look.x}px) scale(${look.scale})`,
        transformOrigin: "50% 45%",
        filter: filters.length ? filters.join(" ") : undefined,
      }}
    >
      {look.hblur > 0.5 ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id={filterId} x="-20%" y="0" width="140%" height="100%">
            <feGaussianBlur stdDeviation={`${look.hblur} 0`} />
          </filter>
        </svg>
      ) : null}
      {children}
    </AbsoluteFill>
  );
};

export const ShotSequence: React.FC<{ readonly shot: Shot; readonly children: React.ReactNode }> = ({ shot, children }) => (
  <Sequence from={shot.from - PAD} durationInFrames={shot.dur + 2 * PAD} name={shot.id}>
    <ShotContext.Provider value={shot}>
      <Seam shot={shot}>{children}</Seam>
    </ShotContext.Provider>
  </Sequence>
);
