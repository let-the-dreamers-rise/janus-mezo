// Shot 2. "5x needs votes" lands, then beat-step-list-theme-cycle (adapted: beats sit on the
// spoken words, not on music) cycles the weekly chores through a capsule that alternates
// bronze and patina, and a boost meter stuck at 1x closes the thought.
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { useShot } from "../shot";
import { C, EASE, MONO, SANS, SERIF, bronze, patina, prog, ramp } from "../theme";
import { wordF } from "../timeline";

const ROW = 150;
const WORDS = ["Getting votes", "Post bribes", "Chase voters", "Poke your boost", "Every single week", "Post bribes", "Chase voters"];
const THEMES = [
  { pill: "#2a2521", bg: "#0e0d0c" },
  { pill: "#d89d54", bg: "#14100c" },
  { pill: "#5fbfa5", bg: "#0b1311" },
  { pill: "#d89d54", bg: "#14100c" },
  { pill: "#5fbfa5", bg: "#0b1311" },
];

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + ((pb[i] as number) - v) * t)).join(",")})`;
};
const snap = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3.2);

export const Problem: React.FC = () => {
  const { f } = useShot();
  const firstBeat = wordF("problem", "post");
  const beats = [firstBeat, wordF("problem", "chase"), wordF("problem", "poke"), wordF("problem", "every")];

  // Phase A: "5x needs veMEZO votes"
  const fiveIn = prog(f, wordF("problem", "five") - 6, wordF("problem", "five") + 12);
  const needIn = prog(f, wordF("problem", "needs"), wordF("problem", "needs") + 14);
  const lift = prog(f, wordF("problem", "manual") - 10, wordF("problem", "manual") + 14, EASE.inOut);

  // Phase B: the chore list
  const listIn = prog(f, firstBeat - 26, firstBeat - 8);
  const fired = beats.filter((b) => f >= b).length;
  const last = beats[fired - 1] ?? 0;
  const t = fired === 0 ? 1 : snap((f - last) / 6);
  const step = fired === 0 ? 0 : fired - 1 + t;
  const prev = THEMES[Math.max(0, fired - 1)] as (typeof THEMES)[number];
  const now = THEMES[fired] as (typeof THEMES)[number];
  const pill = mix(prev.pill, now.pill, fired === 0 ? 1 : t);
  const bg = mix(prev.bg, now.bg, fired === 0 ? 1 : t);
  const pop = fired === 0 ? 1 : interpolate(t, [0, 0.6, 1], [1.12, 0.97, 1]);

  // Phase C: the meter that never moves
  const never = wordF("problem", "never");
  const meterIn = prog(f, wordF("problem", "so") - 4, wordF("problem", "so") + 14);
  const dim = prog(f, wordF("problem", "so") - 10, wordF("problem", "so") + 1);
  const strain = ramp(f, [never - 6, never + 6, never + 14], [0, 0.06, 0.02]);

  return (
    <AbsoluteFill style={{ background: bg, fontFamily: SANS }}>
      {/* Phase A headline, which becomes the header */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: interpolate(lift, [0, 1], [330, 70]),
          textAlign: "center",
          transform: `scale(${1 - 0.55 * lift})`,
          transformOrigin: "50% 0",
          opacity: 1 - dim * 0.6,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 34, letterSpacing: "0.16em", color: C.muted, textTransform: "uppercase", opacity: fiveIn }}>
          Mezo Earn boost
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 260,
            lineHeight: 1,
            color: C.bronze,
            opacity: fiveIn,
            filter: `blur(${(1 - fiveIn) * 10}px)`,
            transform: `translateY(${(1 - fiveIn) * 40}px)`,
          }}
        >
          up to 5x
        </div>
        <div style={{ fontSize: 46, color: C.fg, marginTop: 18, opacity: needIn * (1 - lift), transform: `translateY(${(1 - needIn) * 20}px)` }}>
          needs <span style={{ color: C.patina, fontWeight: 600 }}>veMEZO votes</span> on your gauge
        </div>
      </div>

      {/* Phase B list + capsule */}
      <AbsoluteFill
        style={{
          opacity: listIn * (1 - dim),
          filter: `blur(${dim * 6}px)`,
          WebkitMaskImage: "linear-gradient(transparent 0px, transparent 340px, black 450px, black 780px, transparent 960px)",
          maskImage: "linear-gradient(transparent 0px, transparent 340px, black 450px, black 780px, transparent 960px)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 600 - ROW / 2 + 12,
            width: 980,
            height: ROW - 24,
            transform: `translateX(-50%) scale(${pop})`,
            background: pill,
            borderRadius: 999,
            boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
          }}
        />
        <div style={{ position: "absolute", left: 0, right: 0, top: 600 - ROW / 2, transform: `translateY(${-step * ROW}px)` }}>
          {WORDS.map((w, i) => {
            const sel = i === fired;
            return (
              <div key={i} style={{ height: ROW, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span
                  style={{
                    fontFamily: SERIF,
                    fontSize: 104,
                    color: sel ? (fired === 0 ? C.muted : "#120e0b") : "rgba(240,232,220,0.3)",
                  }}
                >
                  {w}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, height: 230, background: `linear-gradient(${bg}, transparent)` }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 360, background: `linear-gradient(transparent, ${bg} 70%)` }} />
      </AbsoluteFill>

      {/* Phase C meter */}
      <div
        style={{
          position: "absolute",
          left: 360,
          right: 360,
          top: 520,
          opacity: meterIn,
          transform: `translateY(${(1 - meterIn) * 30}px)`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 40, color: C.muted, marginBottom: 18 }}>
          <span style={{ color: C.fg }}>1x</span>
          <span style={{ color: C.bronze }}>5x</span>
        </div>
        <div style={{ position: "relative", height: 26, borderRadius: 13, background: "#1d1a17", boxShadow: `inset 0 0 0 1px ${C.border}` }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(0.02 + strain) * 100}%`, borderRadius: 13, background: C.bronze }} />
          <div style={{ position: "absolute", right: -6, top: -6, width: 38, height: 38, borderRadius: 19, border: `2px dashed ${bronze(0.7)}` }} />
        </div>
        <div style={{ marginTop: 26, textAlign: "center", fontFamily: SERIF, fontSize: 60, color: C.fg }}>
          No votes, no boost. <span style={{ fontStyle: "italic", color: patina(1) }}>Most locks sit at 1x.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
