// Shot 10 (outro-group-photo-launch): the mark and "Janus" stamp in on the spoken name, then
// one piece from every shot flies in from its side and settles around the wordmark (y1 > 1
// landing), crane, stage light, warm dust; the live URL lands and the frame holds.
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { CoinMark } from "../components/CoinMark";
import { Crop, PageCam } from "../components/PageCam";
import { pageH, type State } from "../layout";
import { useShot } from "../shot";
import { C, EASE, MONO, SERIF, bronze, prog, ramp } from "../theme";
import { wordF } from "../timeline";

interface El {
  readonly src: State;
  readonly rect: { x: number; y: number; w: number; h: number };
  readonly cx: number;
  readonly cy: number;
  readonly scale: number;
  readonly rot: number;
  readonly dx: number;
  readonly dy: number;
}

const ELS: readonly El[] = [
  { src: "start-2", rect: { x: 1204, y: 408, w: 380, h: 508 }, cx: 260, cy: 560, scale: 0.8, rot: -4, dx: -520, dy: 0 },
  { src: "market-0", rect: { x: 337, y: 902, w: 1246, h: 46 }, cx: 960, cy: 130, scale: 0.92, rot: 1.2, dx: 0, dy: -260 },
  { src: "earn-0", rect: { x: 336, y: 554, w: 360, h: 258 }, cx: 1650, cy: 360, scale: 0.86, rot: 4, dx: 520, dy: -120 },
  { src: "boost-2", rect: { x: 361, y: 747, w: 786, h: 122 }, cx: 520, cy: 910, scale: 0.78, rot: 2, dx: -320, dy: 300 },
  { src: "home-0", rect: { x: 874, y: 1922, w: 348, h: 102 }, cx: 1650, cy: 760, scale: 1.2, rot: -3, dx: 480, dy: 220 },
  { src: "market-0", rect: { x: 337, y: 1236, w: 1246, h: 46 }, cx: 1340, cy: 975, scale: 0.72, rot: -1.5, dx: 320, dy: 320 },
];

const DUST = Array.from({ length: 20 }, (_, i) => ({
  x: (i * 439 + 137) % 1920,
  y0: (i * 613 + 271) % 1080,
  rise: 0.3 + (i % 5) * 0.11,
  sway: 9 + (i % 4) * 5,
  freq: 0.022 + (i % 3) * 0.008,
  phase: (i * 0.83) % (Math.PI * 2),
  size: 2 + (i % 3) * 0.6,
  opacity: 0.18 + ((i * 7) % 5) * 0.05,
}));

export const Close: React.FC = () => {
  const { f, dur } = useShot();
  const name = wordF("close", "janus");
  const two = wordF("close", "two");
  const tryAt = wordF("close", "try");
  const cues = ELS.map((_, i) => two - 4 + i * 4);
  const lastLand = (cues[cues.length - 1] as number) + 12;

  const coin = prog(f, name - 14, name + 4, EASE.land);
  const crane = prog(f, 0, 40, Easing.bezier(0.3, 0, 0.2, 1));
  const push = prog(f, 40, dur, (t) => t);
  const camScale = 1.06 - 0.06 * crane + 0.035 * push;
  const recede = prog(f, lastLand + 2, lastLand + 10);
  const stage = ramp(f, [name - 6, name + 4, name + 14], [0, 0.5, 0.25]);
  const rule = prog(f, name + 10, name + 22);
  const url = prog(f, name + 18, name + 30);
  const tryPulse = ramp(f, [tryAt, tryAt + 5, tryAt + 12], [1, 1.04, 1]);
  const underline = prog(f, tryAt, tryAt + 14, EASE.out);
  const fade = prog(f, dur - 14, dur);

  return (
    <AbsoluteFill style={{ background: C.bg, opacity: 1 - fade }}>
      <AbsoluteFill style={{ transform: `perspective(1400px) rotateX(${4 * (1 - crane)}deg) scale(${camScale})`, transformOrigin: "50% 45%" }}>
        <AbsoluteFill style={{ opacity: 0.55 }}>
          <PageCam src="home-0" pageH={pageH("home-0")} cam={{ cx: 960, cy: 420, zoom: 0.9, rotX: 0, rotY: 0 }} blur={16} />
        </AbsoluteFill>
        <AbsoluteFill style={{ background: "radial-gradient(1100px 700px at 50% 46%, rgba(14,13,12,0.55), rgba(14,13,12,0.88) 70%)" }} />
        {ELS.map((el, i) => {
          const cue = cues[i] as number;
          if (f < cue) return null;
          const t = prog(f, cue, cue + 12, EASE.land);
          const air = Math.max(0, 1 - t);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: el.cx - el.rect.w / 2,
                top: el.cy - el.rect.h / 2,
                width: el.rect.w,
                height: el.rect.h,
                transform: `translate(${el.dx * (1 - t)}px, ${el.dy * (1 - t)}px) rotate(${el.rot * (2 - t)}deg) scale(${el.scale * (1.12 - 0.12 * t)})`,
                opacity: prog(f, cue, cue + 3) * (1 - 0.14 * recede),
                filter: `saturate(${1 - 0.1 * recede})`,
              }}
            >
              <Crop
                src={el.src}
                pageH={pageH(el.src)}
                rect={el.rect}
                at={{ x: 0, y: 0 }}
                style={{ borderRadius: 10, boxShadow: `0 0 0 1px ${C.border}, 0 ${12 + 26 * air}px ${30 + 50 * air}px rgba(0,0,0,0.6)` }}
              />
            </div>
          );
        })}
      </AbsoluteFill>

      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {DUST.map((d, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.x + Math.sin(f * d.freq + d.phase) * d.sway,
              top: ((((d.y0 - f * d.rise) % 1080) + 1080) % 1080),
              width: d.size,
              height: d.size,
              borderRadius: "50%",
              background: "hsl(38 60% 72%)",
              opacity: d.opacity,
            }}
          />
        ))}
      </AbsoluteFill>
      {stage > 0 ? <AbsoluteFill style={{ background: `radial-gradient(720px 380px at 960px 470px, ${bronze(0.28)}, ${bronze(0.08)} 55%, transparent 75%)`, opacity: stage * 2 }} /> : null}

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
            <div style={{ opacity: coin, transform: `scale(${0.6 + 0.4 * coin})` }}>
              <CoinMark size={150} />
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 190, lineHeight: 1, color: C.fg, display: "flex" }}>
              {"Janus".split("").map((ch, i) => {
                const d = name - 10 + i * 2.5;
                const t = prog(f, d, d + 9, Easing.bezier(0.2, 0.75, 0.3, 1));
                return (
                  <span key={i} style={{ display: "inline-block", opacity: t, transform: `translateY(${(1 - t) * 28}px) scale(${1.35 - 0.35 * t})`, filter: `blur(${(1 - t) * 8}px)` }}>
                    {ch}
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{ height: 4, width: 300, marginTop: 34, borderRadius: 2, background: C.bronze, transform: `scaleX(${rule})` }} />
          <div
            style={{
              position: "relative",
              marginTop: 34,
              fontFamily: MONO,
              fontSize: 48,
              color: C.fg,
              opacity: url,
              transform: `translateY(${(1 - url) * 14}px) scale(${tryPulse})`,
            }}
          >
            janus-mezo.vercel.app
            <div style={{ position: "absolute", left: 0, bottom: -10, height: 3, width: `${underline * 100}%`, background: C.bronze, boxShadow: `0 0 12px ${bronze(0.6)}` }} />
          </div>
          <div style={{ marginTop: 26, fontFamily: MONO, fontSize: 32, letterSpacing: "0.08em", color: C.muted, opacity: url }}>
            Live on Mezo Matsnet. Demo wallet, no install.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
