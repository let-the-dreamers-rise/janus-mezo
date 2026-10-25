// Shot 1 (brand-ink-open, re-skinned): a bronze pen draws the coin's rim, both faces fill,
// "Janus" stamps in letter by letter, a mono kicker types, the lockup holds well over 1 s
// under the hook line, then lifts away on "there's a catch".
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { CoinMark } from "../components/CoinMark";
import { useShot } from "../shot";
import { C, EASE, MONO, SERIF, bronze, prog, ramp } from "../theme";
import { wordF } from "../timeline";

const WORD = "Janus";
const KICKER = "The boost market for Mezo";

export const Brand: React.FC = () => {
  const { f } = useShot();
  const draw = prog(f, 2, 20, Easing.bezier(0.3, 0, 0.2, 1));
  const fill = prog(f, 14, 30, EASE.enter);
  const glow = prog(f, 0, 40, EASE.out);

  const kickStart = 50;
  const chars = Math.max(0, Math.floor((f - kickStart) / 0.9));
  const kickDone = kickStart + KICKER.length * 0.9;
  const caretOn = f >= kickStart && (f < kickDone || (f < kickDone + 60 && Math.floor((f - kickDone) / 6) % 2 === 0));

  const exitAt = wordF("hook", "catch") + 18;
  const out = prog(f, exitAt, exitAt + 9, Easing.bezier(0.4, 0, 0.5, 1));

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 520px at 50% 46%, ${bronze(0.1 * glow)}, transparent 70%)`,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: 1 - out,
          transform: `translateY(${-40 * out}px) scale(${1 - 0.12 * out})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          <CoinMark size={190} draw={draw} fill={fill} />
          <div style={{ fontFamily: SERIF, fontSize: 230, lineHeight: 1, color: C.fg, display: "flex", letterSpacing: "-0.01em" }}>
            {WORD.split("").map((ch, i) => {
              const d = 22 + i * 3;
              const t = prog(f, d, d + 12, Easing.bezier(0.2, 0.7, 0.25, 1));
              const glint = ramp(f, [d + 8, d + 12, d + 16], [0, 1, 0]);
              return (
                <span
                  key={i}
                  style={{
                    position: "relative",
                    display: "inline-block",
                    opacity: t,
                    transform: `scale(${1.6 - 0.6 * t})`,
                    transformOrigin: "center bottom",
                    filter: `blur(${(1 - t) * 6}px)`,
                  }}
                >
                  {ch}
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: 18,
                      transform: "translateX(-50%)",
                      width: `${glint * 100}%`,
                      height: 3,
                      background: C.bronze,
                      opacity: glint,
                      borderRadius: 2,
                    }}
                  />
                </span>
              );
            })}
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            height: 44,
            fontFamily: MONO,
            fontSize: 36,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: C.muted,
            display: "flex",
            alignItems: "center",
          }}
        >
          <span style={{ whiteSpace: "pre" }}>{KICKER.slice(0, chars)}</span>
          <span style={{ width: 18, height: 34, marginLeft: 6, background: C.bronze, opacity: caretOn ? 0.85 : 0 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
