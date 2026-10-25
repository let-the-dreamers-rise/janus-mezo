// Shot 6, the bronze face on /boost/: create the gauge, tap 5x and the "Top +10%" quick bid
// (cursor-flyover), then the fill preview is the hero (spotlight-hero-card): lifted, beam
// laps, the three numbers marked on their words, reseated; Approve, and the bid is live.
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { Crop, Layer, PageCam, camAt, type CamKey } from "../components/PageCam";
import { Cursor } from "../components/Cursor";
import { box, pageH } from "../layout";
import { useShot } from "../shot";
import { C, EASE, MONO, bronze, prog, ramp } from "../theme";
import { wordF } from "../timeline";

const H = pageH("boost-1");
const GAUGE = box("boost-0", /^Create boost gauge$/, "button");
const FIVE = box("boost-1", /^5x$/, "button");
const TOP10 = box("boost-1", /^Top \+10%/, "button");
const APPROVE = box("boost-2", /^Approve/, "button");
const HERO = { x: 361, y: 747, w: 786, h: 122 };
const ESCROW = box("boost-3", /^1\.12 MUSD$/, "dd");
const c = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const RADIUS = 8;

const Marker: React.FC<{ f: number; at: number; x: number; y: number; w: number }> = ({ f, at, x, y, w }) => {
  const p = prog(f, at, at + 10, EASE.out);
  if (p <= 0) return null;
  return <div style={{ position: "absolute", left: x, top: y, width: w * p, height: 3, borderRadius: 2, background: C.bronze, boxShadow: `0 0 10px ${bronze(0.55)}` }} />;
};

export const Boost: React.FC = () => {
  const { f } = useShot();
  const gaugeAt = wordF("boost", "gauge");
  const fiveAt = wordF("boost", "five");
  const bidAt = wordF("boost", "bid");
  const hero0 = wordF("boost", "janus") - 6;
  const rise0 = hero0 + 18;
  const firstAt = wordF("boost", "first");
  const reseat0 = firstAt + 10;
  const approveAt = wordF("boost", "approve");
  const placeAt = wordF("boost", "place");
  const escrowAt = wordF("boost", "escrow");

  const keys: CamKey[] = [
    { f: 0, cx: 800, cy: 560, zoom: 1.0 },
    { f: 40, cx: 740, cy: 520, zoom: 1.25 },
    { f: gaugeAt + 8, cx: 740, cy: 560, zoom: 1.3 },
    { f: fiveAt, cx: 700, cy: 640, zoom: 1.6 },
    { f: bidAt + 6, cx: 700, cy: 680, zoom: 1.6 },
    { f: hero0, cx: 740, cy: 760, zoom: 1.5 },
    { f: hero0 + 18, cx: 724, cy: HERO.y + HERO.h / 2, zoom: 2.0, rotY: 12, rotX: 5, ease: Easing.bezier(0.35, 0, 0.2, 1) },
    { f: reseat0 + 16, cx: 724, cy: HERO.y + HERO.h / 2, zoom: 2.0, rotY: 12, rotX: 5 },
    { f: approveAt - 6, cx: 640, cy: 850, zoom: 1.55 },
    { f: placeAt + 6, cx: 640, cy: 850, zoom: 1.55 },
    { f: placeAt + 26, cx: 754, cy: 500, zoom: 1.65 },
  ];
  const cam = camAt(keys, f);

  const toForm = prog(f, gaugeAt + 4, gaugeAt + 12);
  const toPick = prog(f, bidAt + 2, bidAt + 8);
  const toLive = prog(f, placeAt + 3, placeAt + 10);

  // hero arc: rise (overshoot), hover with a slow bob, reseat
  const rise = prog(f, rise0, rise0 + 10, Easing.bezier(0.2, 1.25, 0.3, 1));
  const reseat = prog(f, reseat0, reseat0 + 16, Easing.bezier(0.4, 0, 0.3, 1.05));
  const lift = rise * (1 - reseat);
  const z = 90 * lift + Math.sin(((f - rise0) / 40) * Math.PI * 2) * 4 * lift;
  const airborne = f >= rise0 && f < reseat0 + 16;
  const lap1 = prog(f, rise0 + 12, rise0 + 26, (t) => t);
  const lap2 = prog(f, rise0 + 32, rise0 + 52, Easing.bezier(0.4, 0, 0.4, 1));
  const lapOn = f >= rise0 + 11 && f <= rise0 + 53;
  const pool = Math.min(prog(f, hero0 - 10, hero0 + 14), 1 - prog(f, reseat0 + 4, reseat0 + 24));

  const marks = [
    { at: wordF("boost", "votes"), x: 16, y: 58, w: 96 },
    { at: wordF("boost", "cost"), x: 272, y: 58, w: 84 },
    { at: wordF("boost", "lands"), x: 16, y: 110, w: 182 },
  ];
  const firstGlow = ramp(f, [firstAt - 2, firstAt + 6, reseat0], [0, 1, 0.6]);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <PageCam src="boost-0" pageH={pageH("boost-0")} cam={cam}>
        <Layer src="boost-1" pageH={H} opacity={toForm} />
        <Layer src="boost-2" pageH={H} opacity={toPick} />
        <div style={{ transformStyle: "preserve-3d" }}>
          {airborne ? (
            <div
              style={{
                position: "absolute",
                left: HERO.x - 2,
                top: HERO.y - 2,
                width: HERO.w + 4,
                height: HERO.h + 4,
                borderRadius: RADIUS,
                background: "#161413",
                boxShadow: `inset 0 0 0 1.5px ${bronze(0.35 + 0.4 * (1 - reseat))}`,
                opacity: Math.min(1, rise * 2),
              }}
            />
          ) : null}
          {f >= hero0 && f < reseat0 + 30 ? (
            <div style={{ position: "absolute", left: HERO.x, top: HERO.y, width: HERO.w, height: HERO.h, transform: `translateZ(${z}px)`, transformStyle: "preserve-3d" }}>
              <Crop
                src="boost-2"
                pageH={H}
                rect={HERO}
                at={{ x: 0, y: 0 }}
                style={{
                  borderRadius: RADIUS,
                  boxShadow: lift > 0.01 ? `0 ${8 * lift}px ${16 * lift}px rgba(0,0,0,${0.4 * lift}), 0 ${40 * lift}px ${90 * lift}px rgba(0,0,0,${0.55 * lift})` : "none",
                }}
              />
              {marks.map((m, i) => (
                <Marker key={i} f={f} at={m.at} x={m.x} y={m.y} w={m.w} />
              ))}
              {firstGlow > 0 ? (
                <div style={{ position: "absolute", left: 128, top: 86, width: 66, height: 26, borderRadius: 6, boxShadow: `0 0 0 2px ${bronze(firstGlow)}, 0 0 18px ${bronze(0.45 * firstGlow)}` }} />
              ) : null}
              {lapOn && lift > 0.4 ? (
                <svg width={HERO.w + 6} height={HERO.h + 6} style={{ position: "absolute", left: -3, top: -3, overflow: "visible", opacity: f <= rise0 + 27 ? 1 : 0.62, filter: `drop-shadow(0 0 6px ${C.bronze}) drop-shadow(0 0 16px ${bronze(0.5)})` }}>
                  <rect x={2} y={2} width={HERO.w + 2} height={HERO.h + 2} rx={RADIUS} fill="none" stroke={C.bronze} strokeWidth={f <= rise0 + 27 ? 4 : 3} pathLength={1} strokeDasharray="0.14 1" strokeDashoffset={-(f <= rise0 + 27 ? lap1 : lap2)} strokeLinecap="round" />
                  <rect x={2} y={2} width={HERO.w + 2} height={HERO.h + 2} rx={RADIUS} fill="none" stroke="rgba(255,244,226,0.95)" strokeWidth={1.6} pathLength={1} strokeDasharray="0.14 1" strokeDashoffset={-(f <= rise0 + 27 ? lap1 : lap2)} strokeLinecap="round" />
                </svg>
              ) : null}
            </div>
          ) : null}
        </div>
        {/* After Approve the same button turns into "Place bid" (step 2 of 2), as in the app. */}
        {f >= approveAt + 4 ? (
          <div
            style={{
              position: "absolute",
              left: APPROVE.x,
              top: APPROVE.y,
              width: APPROVE.w,
              height: APPROVE.h,
              borderRadius: 8,
              background: C.bronze,
              color: "#1a130b",
              fontFamily: MONO,
              fontSize: 15,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: prog(f, approveAt + 4, approveAt + 9),
              transform: `scale(${ramp(f, [placeAt, placeAt + 3, placeAt + 8], [1, 0.95, 1])})`,
            }}
          >
            Place bid
          </div>
        ) : null}
        {f >= approveAt + 4 ? (
          <div
            style={{
              position: "absolute",
              left: APPROVE.x + APPROVE.w + 8,
              top: APPROVE.y,
              width: 360,
              height: APPROVE.h,
              background: "#161413",
              color: C.muted,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              paddingLeft: 4,
              opacity: prog(f, approveAt + 4, approveAt + 9),
            }}
          >
            Step 2 of 2. Your bid joins the book for the next round.
          </div>
        ) : null}
        <Layer src="boost-3" pageH={pageH("boost-3")} opacity={toLive} />
        <Marker f={f} at={escrowAt} x={ESCROW.x} y={ESCROW.y + ESCROW.h + 2} w={78} />
        <Cursor
          f={f}
          zoom={cam.zoom}
          appear={18}
          hide={hero0 - 4}
          keys={[
            { f: 0, x: 1100, y: 820 },
            { f: gaugeAt - 2, ...c(GAUGE) },
            { f: fiveAt - 2, ...c(FIVE) },
            { f: bidAt - 2, ...c(TOP10) },
          ]}
          clicks={[gaugeAt, fiveAt, bidAt]}
        />
        <Cursor
          f={f}
          zoom={cam.zoom}
          appear={approveAt - 18}
          hide={placeAt + 16}
          keys={[
            { f: approveAt - 18, x: 820, y: 1010 },
            { f: approveAt - 2, ...c(APPROVE) },
          ]}
          clicks={[approveAt, placeAt]}
        />
      </PageCam>
      {pool > 0 ? (
        <AbsoluteFill style={{ background: `radial-gradient(760px 420px at 50% 50%, transparent 40%, rgba(5,4,3,${0.62 * pool}) 100%)`, pointerEvents: "none" }} />
      ) : null}
    </AbsoluteFill>
  );
};
