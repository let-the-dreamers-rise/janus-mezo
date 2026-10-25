// Janus brand tokens (brand.md) and the film's motion personality (DESIGN.md section 1).
import { Easing, interpolate } from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const SERIF = loadSerif().fontFamily;
export const SANS = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const MONO = loadMono("normal", { weights: ["400", "500", "700"], subsets: ["latin"] }).fontFamily;

export const C = {
  bg: "hsl(30 9% 5%)",
  card: "hsl(30 8% 8%)",
  fg: "hsl(38 28% 90%)",
  muted: "hsl(36 10% 64%)",
  border: "hsl(30 7% 18%)",
  bronze: "hsl(35 62% 58%)",
  patina: "hsl(164 38% 56%)",
} as const;

export const bronze = (a: number) => `hsl(35 62% 58% / ${a})`;
export const patina = (a: number) => `hsl(164 38% 56% / ${a})`;

export const EASE = {
  /** Entrances: calm, exact. */
  enter: Easing.bezier(0.22, 1, 0.36, 1),
  /** Camera moves. */
  cam: Easing.bezier(0.33, 0, 0.15, 1),
  inOut: Easing.bezier(0.45, 0, 0.25, 1),
  /** Physical landings only: y1 > 1 so it really overshoots. */
  land: Easing.bezier(0.34, 1.4, 0.44, 1),
  out: Easing.out(Easing.cubic),
} as const;

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0..1 progress of frame `f` through [a, b], eased. */
export const prog = (f: number, a: number, b: number, easing: (t: number) => number = EASE.enter) =>
  interpolate(f, [a, b], [0, 1], { ...CLAMP, easing });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Clamped multi-stop interpolation. */
export const ramp = (f: number, input: number[], output: number[], easing?: (t: number) => number) =>
  interpolate(f, input, output, { ...CLAMP, easing });
