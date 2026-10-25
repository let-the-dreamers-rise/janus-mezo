// Shot 8, the patina face. "Flip the coin": a full coin turns from bronze to patina and gives
// way to /earn/ for the seeded holder; the camera reads the vault tiles, marks "1 jMEZO per
// MEZO locked", then pushes into the position card and lays one sheen across the Claim
// button (light-play-moves B, the film's single sheen).
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { PageCam, camAt, type CamKey } from "../components/PageCam";
import { pageH } from "../layout";
import { useShot } from "../shot";
import { C, EASE, bronze, patina, prog, ramp } from "../theme";
import { wordF } from "../timeline";

const H = pageH("earn-0");
const TILE2 = { x: 651, y: 313, w: 303, h: 101 };
const CLAIMABLE = { x: 361, y: 699, w: 147, h: 28 };
const CLAIM_BTN = { x: 361, y: 747, w: 310, h: 40 };

export const Earn: React.FC = () => {
  const { f } = useShot();
  const flip0 = Math.max(4, wordF("earn", "flip") - 2);
  const angle = f < flip0 + 20 ? ramp(f, [flip0, flip0 + 20], [0, 192], Easing.bezier(0.55, 0, 0.3, 1)) : ramp(f, [flip0 + 20, flip0 + 28], [192, 180], Easing.out(Easing.poly(5)));
  const coinOut = prog(f, flip0 + 34, flip0 + 50, EASE.inOut);
  const pageIn = prog(f, flip0 + 30, flip0 + 50);
  const deposit = wordF("earn", "deposit");
  const oneToOne = wordF("earn", "one");
  const claim = wordF("earn", "claim");

  const keys: CamKey[] = [
    { f: 0, cx: 960, cy: 400, zoom: 1.38 },
    { f: deposit - 6, cx: 960, cy: 400, zoom: 1.4 },
    { f: deposit + 16, cx: 900, cy: 400, zoom: 1.6 },
    { f: claim - 14, cx: 900, cy: 420, zoom: 1.6 },
    { f: claim + 8, cx: 516, cy: 690, zoom: 2.05 },
  ];
  const cam = camAt(keys, f);
  const mark = prog(f, oneToOne, oneToOne + 10, EASE.out);
  const claimMark = prog(f, claim + 6, claim + 16, EASE.out);
  const sweepOn = f >= claim + 14 && f <= claim + 44;
  const sweepX = ramp(f, [claim + 14, claim + 44], [-CLAIM_BTN.w * 1.6, CLAIM_BTN.w], Easing.inOut(Easing.cubic));
  const face = Math.cos((angle * Math.PI) / 180);
  const patinaSide = face < 0;

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ opacity: pageIn }}>
        <PageCam src="earn-0" pageH={H} cam={cam}>
          {mark > 0 ? <div style={{ position: "absolute", left: TILE2.x + 17, top: TILE2.y + 84, width: 204 * mark, height: 3, borderRadius: 2, background: C.patina, boxShadow: `0 0 10px ${patina(0.6)}` }} /> : null}
          {claimMark > 0 ? <div style={{ position: "absolute", left: CLAIMABLE.x, top: CLAIMABLE.y + CLAIMABLE.h + 3, width: CLAIMABLE.w * claimMark, height: 3, borderRadius: 2, background: C.patina, boxShadow: `0 0 10px ${patina(0.6)}` }} /> : null}
          {sweepOn ? (
            <div style={{ position: "absolute", left: CLAIM_BTN.x, top: CLAIM_BTN.y, width: CLAIM_BTN.w, height: CLAIM_BTN.h, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: CLAIM_BTN.w * 1.6, height: CLAIM_BTN.h, transform: `translateX(${sweepX}px)`, background: "linear-gradient(115deg, transparent 40%, rgba(255,250,240,0.4) 50%, transparent 60%)" }} />
            </div>
          ) : null}
        </PageCam>
      </AbsoluteFill>
      {coinOut < 1 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 1 - coinOut }}>
          {/* One face at a time, squashed by |cos|: no backface tricks, so it can never show bronze after the turn. */}
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: "50%",
              transform: `scale(${1 - 0.5 * coinOut}) scaleX(${Math.max(0.04, Math.abs(face))})`,
              background: patinaSide ? `radial-gradient(circle at 35% 30%, hsl(164 45% 70%), ${C.patina} 55%, hsl(164 38% 34%))` : `radial-gradient(circle at 35% 30%, hsl(35 75% 74%), ${C.bronze} 55%, hsl(35 55% 36%))`,
              boxShadow: `0 0 0 10px hsl(36 10% 22%), 0 30px 80px rgba(0,0,0,0.6), 0 0 120px ${patinaSide ? patina(0.25) : bronze(0.25)}`,
            }}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
