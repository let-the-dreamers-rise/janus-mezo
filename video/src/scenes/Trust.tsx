// Shot 9, "Built on Mezo's own contracts" (wall-reveal-moves A, bento light-up): the four
// contract cards wait dimmed and light one by one as they are named, each traced by a bronze
// stroke; a 125 counter for the contract tests lands beside them, then a slow push.
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { PageCam, camAt, type CamKey } from "../components/PageCam";
import { box, pageH } from "../layout";
import { useShot } from "../shot";
import { C, EASE, MONO, SANS, bronze, prog, ramp } from "../theme";
import { wordF } from "../timeline";

const H = pageH("home-0");
const CARDS = [
  box("home-0", /^BoostVoter/, "li"),
  box("home-0", /^veBTC The NFTs/, "li"),
  box("home-0", /^veMEZO The locks/, "li"),
  box("home-0", /^MUSD Every bid/, "li"),
];
const DIGITS = "0123456789";

const Reel: React.FC<{ f: number; at: number; d: number; i: number }> = ({ f, at, d, i }) => {
  const p = prog(f, at + i * 5, at + i * 5 + 22, Easing.bezier(0.25, 0.8, 0.25, 1));
  return (
    <span style={{ display: "inline-block", height: 96, overflow: "hidden" }}>
      <span style={{ display: "block", transform: `translateY(${-(10 + d) * p * 96}px)` }}>
        {(DIGITS + DIGITS).split("").map((x, j) => (
          <span key={j} style={{ display: "block", height: 96, lineHeight: "96px" }}>
            {x}
          </span>
        ))}
      </span>
    </span>
  );
};

export const Trust: React.FC = () => {
  const { f } = useShot();
  const lights = [wordF("trust", "BoostVoter"), wordF("trust", "veBTC"), wordF("trust", "veMEZO"), wordF("trust", "veMEZO") + 22];
  const tests = wordF("trust", "hundred");
  const keys: CamKey[] = [
    { f: 0, cx: 960, cy: 2030, zoom: 1.14 },
    { f: tests + 30, cx: 960, cy: 2040, zoom: 1.2 },
    { f: tests + 70, cx: 960, cy: 2040, zoom: 1.24 },
  ];
  const cam = camAt(keys, f);
  const block = prog(f, tests - 8, tests + 8);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <PageCam src="home-0" pageH={H} cam={cam}>
        {CARDS.map((c, i) => {
          const s = lights[i] as number;
          const draw = prog(f, s, s + 8, EASE.out);
          const lit = prog(f, s + 6, s + 14, EASE.out);
          const stroke = ramp(f, [s + 12, s + 26], [1, 0.4]);
          const glow = lit * (1 - lit) * 4;
          return (
            <React.Fragment key={i}>
              <div style={{ position: "absolute", left: c.x - 1, top: c.y - 1, width: c.w + 2, height: c.h + 2, borderRadius: 10, background: "rgba(14,13,12,0.82)", opacity: 1 - lit }} />
              {glow > 0.01 ? <div style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, borderRadius: 10, boxShadow: `0 0 ${18 * glow}px ${bronze(0.35 * glow)}` }} /> : null}
              {draw > 0 ? (
                <svg width={c.w} height={c.h} style={{ position: "absolute", left: c.x, top: c.y, overflow: "visible" }}>
                  <rect x={1} y={1} width={c.w - 2} height={c.h - 2} rx={10} fill="none" stroke={C.bronze} strokeWidth={2.5} pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} opacity={stroke} style={{ filter: `drop-shadow(0 0 5px ${C.bronze})` }} />
                </svg>
              ) : null}
            </React.Fragment>
          );
        })}
        {block > 0 ? (
          <div style={{ position: "absolute", left: 336, top: 2078, opacity: block, transform: `translateY(${(1 - block) * 14}px)` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 84, color: C.bronze, display: "inline-flex" }}>
                {[1, 2, 5].map((d, i) => (
                  <Reel key={i} f={f} at={tests - 6} d={d} i={i} />
                ))}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 34, fontWeight: 600, color: C.fg }}>contract tests</span>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 28, color: C.muted, marginTop: 4 }}>plus 224 web and 38 keeper tests, all passing</div>
          </div>
        ) : null}
      </PageCam>
    </AbsoluteFill>
  );
};
