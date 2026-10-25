// Shot 5, the judge path on /start/: the cursor clicks "Try with a demo wallet" (punch-in,
// input-trigger-moves A), then "Get the starter kit"; the kit rows drop into the card one by
// one (row-embed) on "Gas, MUSD ... veBTC", and the camera eases out to the checklist.
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { Crop, Layer, PageCam, camAt, type CamKey } from "../components/PageCam";
import { Cursor } from "../components/Cursor";
import { box, pageH } from "../layout";
import { useShot } from "../shot";
import { C, EASE, bronze, prog, ramp } from "../theme";
import { wordF } from "../timeline";

const H = pageH("start-1");
const CARD_BG = "#161413";
const ROWS = [box("start-2", /for gas/, "li"), box("start-2", /to bid with/, "li"), box("start-2", /A veBTC NFT with/, "li")];
const KIT_BTN = box("start-1", /^Get the starter kit$/, "button");

const RowDrop: React.FC<{ f: number; cue: number; r: { x: number; y: number; w: number; h: number } }> = ({ f, cue, r }) => {
  const land = cue + 12;
  const rect = { x: r.x - 6, y: r.y - 5, w: r.w + 12, h: r.h + 10 };
  if (f < cue) return null;
  const p = prog(f, cue, land, Easing.bezier(0.3, 0, 0.25, 1));
  const air = 1 - p;
  const scale = f < land ? 1.06 - 0.065 * p : ramp(f, [land, land + 4], [0.995, 1], Easing.out(Easing.quad));
  const spread = prog(f, land, land + 5, EASE.out);
  const seamO = ramp(f, [land, land + 2, land + 10], [1, 1, 0]);
  return (
    <>
      <div style={{ position: "absolute", left: rect.x - 2, top: rect.y - 2, width: rect.w + 4, height: rect.h + 4, background: CARD_BG }} />
      <Crop
        src="start-2"
        pageH={H}
        rect={rect}
        style={{
          borderRadius: 6,
          opacity: prog(f, cue, cue + 3),
          transform: `perspective(900px) translateY(${-90 * air}px) rotateX(${16 * air}deg) scale(${scale})`,
          boxShadow: `0 ${24 * air}px ${50 * air}px rgba(0,0,0,${0.5 * air})`,
        }}
      />
      {f >= land && f < land + 10 ? (
        <div
          style={{
            position: "absolute",
            left: rect.x + (rect.w * (1 - spread)) / 2,
            top: rect.y + rect.h - 2,
            width: rect.w * spread,
            height: 2,
            background: C.bronze,
            boxShadow: `0 0 8px ${bronze(0.6)}`,
            opacity: seamO,
          }}
        />
      ) : null}
    </>
  );
};

export const Start: React.FC = () => {
  const { f } = useShot();
  const click = wordF("start", "click");
  const more = wordF("start", "more");
  const gasAt = wordF("start", "gas");
  const cues = [gasAt, wordF("start", "MUSD"), wordF("start", "veBTC")];
  const fin = wordF("start", "lock") + 4;

  const keys: CamKey[] = [
    { f: 0, cx: 960, cy: 560, zoom: 0.84 },
    { f: 34, cx: 960, cy: 560, zoom: 0.84 },
    { f: 96, cx: 930, cy: 470, zoom: 1.3 },
    { f: click, cx: 920, cy: 455, zoom: 1.32 },
    { f: click + 12, cx: 912, cy: 432, zoom: 1.58, ease: EASE.out },
    { f: click + 30, cx: 912, cy: 432, zoom: 1.58 },
    { f: more - 4, cx: 1360, cy: 640, zoom: 1.62 },
    { f: gasAt - 10, cx: 1394, cy: 610, zoom: 1.9 },
    { f: fin, cx: 1394, cy: 640, zoom: 1.84 },
    { f: fin + 30, cx: 1010, cy: 640, zoom: 1.02 },
  ];
  const cam = camAt(keys, f);
  const toKit = prog(f, click + 3, click + 11);
  const final = prog(f, fin, fin + 8);
  const sending = prog(f, more + 2, gasAt, Easing.bezier(0.2, 0.6, 0.4, 1));
  const kitBtnC = { x: KIT_BTN.x + KIT_BTN.w / 2, y: KIT_BTN.y + KIT_BTN.h / 2 };

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <PageCam src="start-0" pageH={pageH("start-0")} cam={cam}>
        <Layer src="start-1" pageH={H} opacity={toKit} />
        {toKit > 0.99 ? (
          <>
            {f >= more + 2 && f < gasAt + 6 ? (
              <div style={{ position: "absolute", left: KIT_BTN.x, top: KIT_BTN.y + KIT_BTN.h + 6, width: KIT_BTN.w * sending, height: 3, borderRadius: 2, background: C.bronze, boxShadow: `0 0 8px ${bronze(0.6)}` }} />
            ) : null}
            {ROWS.map((r, i) => (
              <RowDrop key={i} f={f} cue={cues[i] as number} r={r} />
            ))}
          </>
        ) : null}
        <Layer src="start-2" pageH={H} opacity={final} />
        <Cursor
          f={f}
          zoom={cam.zoom}
          appear={64}
          hide={more + 30}
          keys={[
            { f: 0, x: 1240, y: 900 },
            { f: click - 2, x: 915, y: 426 },
            { f: more - 2, x: kitBtnC.x, y: kitBtnC.y + 2 },
          ]}
          clicks={[click, more]}
        />
      </PageCam>
    </AbsoluteFill>
  );
};
