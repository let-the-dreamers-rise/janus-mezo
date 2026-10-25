// Shot 4 (card-flip-reveal): the coin appears with the name, splits into two faces that grow
// into cards, and each card flips (192 deg overshoot, settle to 180) on its line to show what
// that side gets.
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { CoinMark } from "../components/CoinMark";
import { useShot } from "../shot";
import { C, EASE, MONO, SANS, SERIF, bronze, lerp, patina, prog, ramp } from "../theme";
import { wordF } from "../timeline";

const CW = 640;
const CH = 420;
const GAP = 80;
const X0 = (1920 - (CW * 2 + GAP)) / 2;
const Y = 300;

const angleAt = (f: number, s: number) =>
  f < s + 18
    ? ramp(f, [s, s + 18], [0, 192], Easing.bezier(0.55, 0, 0.3, 1))
    : ramp(f, [s + 18, s + 26], [192, 180], Easing.out(Easing.poly(5)));

const Sheen: React.FC<{ angle: number }> = ({ angle }) => {
  const pos = ramp(angle, [35, 145], [-25, 115]);
  const op = Math.max(0, 1 - Math.abs(angle - 90) / 55);
  if (op <= 0.004) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 22,
        opacity: op,
        background: `linear-gradient(105deg, transparent ${pos - 14}%, rgba(255,240,215,0.22) ${pos}%, transparent ${pos + 14}%)`,
      }}
    />
  );
};

const Face: React.FC<{ children: React.ReactNode; tint: string; back?: boolean }> = ({ children, tint, back }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backfaceVisibility: "hidden",
      transform: back ? "rotateY(180deg)" : undefined,
      borderRadius: 22,
      background: `linear-gradient(160deg, ${tint}, ${C.card} 60%)`,
      boxShadow: `inset 0 0 0 1.5px ${C.border}, 0 30px 80px rgba(0,0,0,0.5)`,
      padding: "56px 60px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);

const Card: React.FC<{
  f: number;
  i: 0 | 1;
  grow: number;
  flipAt: number;
  pulseAt?: number;
}> = ({ f, i, grow, flipAt, pulseAt }) => {
  const angle = angleAt(f, flipAt);
  const color = i === 0 ? C.bronze : C.patina;
  const tint = i === 0 ? bronze(0.16) : patina(0.14);
  const pulse = pulseAt ? ramp(f, [pulseAt, pulseAt + 4, pulseAt + 10], [1, 1.06, 1]) : 1;
  const fromX = 960 - CW / 2 + (i === 0 ? -60 : 60);
  const x = lerp(fromX, X0 + i * (CW + GAP), grow);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: Y,
        width: CW,
        height: CH,
        perspective: 1400,
        opacity: grow,
        transform: `scale(${0.4 + 0.6 * grow})`,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transform: `rotateY(${angle}deg)` }}>
        <Face tint={tint}>
          <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: "0.16em", color, textTransform: "uppercase" }}>{i === 0 ? "Bronze face" : "Patina face"}</div>
          <div style={{ fontFamily: SERIF, fontSize: 96, color: C.fg, marginTop: 18 }}>{i === 0 ? "veBTC holders" : "veMEZO holders"}</div>
          <div style={{ fontFamily: SANS, fontSize: 36, color: C.muted, marginTop: 16 }}>{i === 0 ? "Bitcoin locked for Earn" : "MEZO locked for votes"}</div>
          <Sheen angle={angle} />
        </Face>
        <Face tint={tint} back>
          <div style={{ fontFamily: SERIF, fontSize: 110, color: C.fg, lineHeight: 1 }}>{i === 0 ? "Buy boost" : "Sell votes"}</div>
          <div
            style={{
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 76,
              color,
              marginTop: 26,
              transform: `scale(${pulse})`,
              transformOrigin: "0 50%",
            }}
          >
            {i === 0 ? "up to 5x" : "keep 90%"}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 34, color: C.muted, marginTop: 18 }}>
            {i === 0 ? "pay MUSD only for votes delivered" : "of every MUSD payment"}
          </div>
          <Sheen angle={angle} />
        </Face>
      </div>
    </div>
  );
};

export const Faces: React.FC = () => {
  const { f } = useShot();
  const builtAt = wordF("janus", "janus");
  const coinIn = prog(f, builtAt - 12, builtAt + 8, EASE.land);
  const twoAt = wordF("janus", "two");
  const split = prog(f, twoAt - 4, twoAt + 14, EASE.inOut);
  const grow = prog(f, twoAt + 4, twoAt + 22, EASE.enter);
  const nameOut = prog(f, twoAt - 2, twoAt + 10);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(700px 420px at 30% 50%, ${bronze(0.07)}, transparent 70%), radial-gradient(700px 420px at 70% 50%, ${patina(0.06)}, transparent 70%)` }} />
      {split < 0.999 ? (
        <div
          style={{
            position: "absolute",
            left: 960 - 130,
            top: 330,
            opacity: coinIn * (1 - grow),
            transform: `scale(${0.7 + 0.3 * coinIn})`,
          }}
        >
          <CoinMark size={260} split={split} />
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 640,
          textAlign: "center",
          fontFamily: SERIF,
          fontSize: 120,
          color: C.fg,
          opacity: coinIn * (1 - nameOut),
          filter: `blur(${(1 - coinIn) * 6}px)`,
        }}
      >
        Janus
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 150,
          textAlign: "center",
          fontFamily: SERIF,
          fontSize: 72,
          color: C.fg,
          opacity: grow,
        }}
      >
        One market, <span style={{ fontStyle: "italic", color: C.bronze }}>two faces</span>
      </div>
      <Card f={f} i={0} grow={grow} flipAt={wordF("janus", "buy") - 4} />
      <Card f={f} i={1} grow={grow} flipAt={wordF("janus", "sell") - 4} pulseAt={wordF("janus", "ninety")} />
    </AbsoluteFill>
  );
};
