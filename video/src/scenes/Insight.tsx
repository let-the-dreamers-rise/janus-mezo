// Shot 3 (odometer-digit-roll): "$1" of veMEZO against a $75 odometer of locked BTC, each
// digit reel stopping left to right with a half-row overshoot, a pulse on lock, then the line.
import React from "react";
import { AbsoluteFill, Easing, interpolate, interpolateColors } from "remotion";
import { useShot } from "../shot";
import { C, EASE, MONO, SANS, SERIF, prog, ramp } from "../theme";
import { wordF } from "../timeline";

const ROW = 250;
const DW = 150;
const FS = 230;
const SPIN = 0.85;
const DIGITS = [7, 5];

/** Reel position (rows) for digit i at local frame f of the odometer clock. */
const posAt = (f: number, i: number): number => {
  const d = DIGITS[i] as number;
  const s = 20 + i * 7;
  const p0 = SPIN * s;
  const T = Math.ceil((p0 + 6 - d) / 10) * 10 + d;
  if (f < s) return SPIN * Math.max(f, 0);
  if (f < s + 16) return interpolate(f, [s, s + 16], [p0, T + 0.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  if (f < s + 22) return interpolate(f, [s + 16, s + 22], [T + 0.5, T], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return T;
};

const Strip: React.FC<{ pos: number; color: string; opacity?: number; dy?: number }> = ({ pos, color, opacity = 1, dy = 0 }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: DW, transform: `translateY(${-(pos % 10) * ROW + dy}px)`, opacity }}>
    {Array.from({ length: 20 }).map((_, k) => (
      <div key={k} style={{ width: DW, height: ROW, lineHeight: `${ROW}px`, textAlign: "center", fontSize: FS, fontFamily: MONO, fontWeight: 700, color }}>
        {k % 10}
      </div>
    ))}
  </div>
);

const Reel: React.FC<{ f: number; i: number; color: string }> = ({ f, i, color }) => {
  const pos = posAt(f, i);
  const speed = Math.abs(pos - posAt(f - 1, i));
  const gate = ramp(speed, [0.06, 0.5], [0, 1]);
  return (
    <div style={{ position: "relative", width: DW, height: ROW, overflow: "hidden" }}>
      {gate > 0.001 ? (
        <>
          <Strip pos={pos} color={color} opacity={0.25 * gate} dy={ROW * 0.5} />
          <Strip pos={pos} color={color} opacity={0.12 * gate} dy={-ROW * 0.5} />
        </>
      ) : null}
      <Strip pos={pos} color={color} />
    </div>
  );
};

const Label: React.FC<{ text: string; color: string; vis: number }> = ({ text, color, vis }) => (
  <div style={{ fontFamily: SANS, fontSize: 44, fontWeight: 500, color, opacity: vis, transform: `translateY(${(1 - vis) * 14}px)`, marginTop: 6 }}>{text}</div>
);

export const Insight: React.FC = () => {
  const { f } = useShot();
  const kicker = prog(f, wordF("insight", "on") - 4, wordF("insight", "on") + 12);
  const one = prog(f, wordF("insight", "one") - 4, wordF("insight", "one") + 12);
  const oneLabel = prog(f, wordF("insight", "veMEZO"), wordF("insight", "veMEZO") + 12);
  const decides = prog(f, wordF("insight", "decides") - 2, wordF("insight", "decides") + 14);
  const arrow = prog(f, wordF("insight", "decides"), wordF("insight", "seventy"), EASE.inOut);

  const odoStart = wordF("insight", "seventy") - 22;
  const of = f - odoStart;
  const lockF = 20 + 7 + 22;
  const ink = interpolateColors(of, [lockF, lockF + 4, lockF + 8], ["#d89d54", "#f2c27e", "#d89d54"]);
  const pulse = ramp(of, [lockF, lockF + 4, lockF + 8], [1, 1.035, 1], Easing.inOut(Easing.quad));
  const odoIn = prog(of, -6, 4);
  const btcLabel = prog(f, wordF("insight", "locked"), wordF("insight", "locked") + 12);

  const scarce = prog(f, wordF("insight", "votes") - 4, wordF("insight", "votes") + 14);
  const nobody = prog(f, wordF("insight", "nobody") - 2, wordF("insight", "nobody") + 14);
  const rise = prog(f, wordF("insight", "votes") - 8, wordF("insight", "votes") + 12, EASE.inOut);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", top: 96, left: 0, right: 0, textAlign: "center", opacity: kicker }}>
        <div style={{ fontFamily: MONO, fontSize: 34, letterSpacing: "0.16em", color: C.muted, textTransform: "uppercase" }}>Mezo mainnet, 2026-10-24</div>
        <div style={{ fontFamily: MONO, fontSize: 32, color: "hsl(36 10% 52%)", marginTop: 14 }}>280.7M MEZO in veMEZO (about $0.85M) vs 912.6 BTC in veBTC</div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 330 - rise * 70, display: "flex", justifyContent: "center", alignItems: "center", gap: 70 }}>
        <div style={{ textAlign: "center", width: 420 }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: FS, lineHeight: `${ROW}px`, color: C.patina, opacity: one, filter: `blur(${(1 - one) * 10}px)`, transform: `translateY(${(1 - one) * 40}px)` }}>
            $1
          </div>
          <Label text="of veMEZO" color={C.patina} vis={oneLabel} />
        </div>

        <div style={{ width: 330, textAlign: "center", opacity: decides }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 54, color: C.fg }}>decides the boost on</div>
          <svg width={300} height={40} style={{ marginTop: 10 }}>
            <line x1={10} y1={20} x2={10 + 270 * arrow} y2={20} stroke={C.muted} strokeWidth={3} strokeLinecap="round" />
            {arrow > 0.95 ? <path d="M 268 10 L 284 20 L 268 30" fill="none" stroke={C.muted} strokeWidth={3} strokeLinecap="round" /> : null}
          </svg>
        </div>

        <div style={{ textAlign: "center", width: 460, opacity: odoIn }}>
          <div style={{ display: "flex", justifyContent: "center", transform: `scale(${pulse})`, transformOrigin: "50% 50%" }}>
            <div style={{ height: ROW, lineHeight: `${ROW}px`, fontFamily: MONO, fontWeight: 700, fontSize: FS, color: ink, width: 140, textAlign: "right" }}>$</div>
            <Reel f={of} i={0} color={ink} />
            <Reel f={of} i={1} color={ink} />
          </div>
          <Label text="of locked BTC" color={C.bronze} vis={btcLabel} />
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 770, textAlign: "center", fontFamily: SERIF, fontSize: 76, color: C.fg }}>
        <span style={{ opacity: scarce, filter: `blur(${(1 - scarce) * 8}px)`, display: "inline-block", transform: `translateY(${(1 - scarce) * 24}px)` }}>Votes are scarce.</span>{" "}
        <span style={{ opacity: nobody, filter: `blur(${(1 - nobody) * 8}px)`, display: "inline-block", fontStyle: "italic", color: C.bronze, transform: `translateY(${(1 - nobody) * 24}px)` }}>
          And unpriced.
        </span>
      </div>
    </AbsoluteFill>
  );
};
