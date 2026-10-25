// Shot 7, /market/: the order book stacks up rank by rank (list-stack-press) with a counter,
// the camera visits the latest round's payouts, pulls wide and crash-zooms (crash-zoom-punch,
// rebound) onto round #1 in the history, where the facts get marked as they are spoken.
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { Crop, PageCam, camAt, type CamKey } from "../components/PageCam";
import { box, pageH } from "../layout";
import { useShot } from "../shot";
import { C, EASE, MONO, SANS, bronze, patina, prog, ramp } from "../theme";
import { wordF } from "../timeline";

const H = pageH("market-0");
const ROWS = [box("market-0", /^1 #17/, "tr"), box("market-0", /^2 #17/, "tr"), box("market-0", /^3 #17/, "tr"), box("market-0", /^4 #17/, "tr")];
const HISTORY = box("market-0", /^#1 Oct/, "tr");
const PAYS = [box("market-0", /^veBTC #1714/, "li"), box("market-0", /^veBTC #1715/, "li")];
const DUR = 22;
const DIGITS = "0123456789";

const Marker: React.FC<{ f: number; at: number; x: number; y: number; w: number; color?: string }> = ({ f, at, x, y, w, color = C.bronze }) => {
  const p = prog(f, at, at + 10, EASE.out);
  if (p <= 0) return null;
  return <div style={{ position: "absolute", left: x, top: y, width: w * p, height: 3, borderRadius: 2, background: color, boxShadow: `0 0 10px ${color}` }} />;
};

export const Market: React.FC = () => {
  const { f } = useShot();
  const hi = wordF("market", "highest");
  const cues = [hi + 2, hi + 12, hi + 22, hi + 32];
  const vault = wordF("market", "vault");
  const delivered = wordF("market", "delivered");
  const round = wordF("market", "round", 1);
  const hundred = wordF("market", "hundred");
  const five = wordF("market", "five");
  const paid = wordF("market", "paid");
  const rowCy = HISTORY.y + HISTORY.h / 2;

  const keys: CamKey[] = [
    { f: 0, cx: 960, cy: 540, zoom: 0.95 },
    { f: hi - 16, cx: 960, cy: 560, zoom: 0.98 },
    { f: hi + 4, cx: 960, cy: 985, zoom: 1.32 },
    { f: vault - 4, cx: 960, cy: 985, zoom: 1.32 },
    { f: vault + 14, cx: 1328, cy: 470, zoom: 1.7 },
    { f: round - 22, cx: 1328, cy: 470, zoom: 1.7 },
    { f: round - 4, cx: 960, cy: 960, zoom: 0.86 },
    { f: round, cx: 960, cy: 960, zoom: 0.86 },
    { f: round + 6, cx: 960, cy: rowCy, zoom: 1.5, ease: Easing.bezier(0.55, 0, 0.7, 1) },
    { f: round + 11, cx: 960, cy: rowCy, zoom: 1.44, ease: EASE.out },
    { f: paid + 40, cx: 1000, cy: rowCy - 10, zoom: 1.46 },
  ];
  const cam = camAt(keys, f);

  // the stack: later arrivals press the settled rows down, then they spring back
  const press = (i: number) =>
    cues.slice(i + 1).reduce((p, c) => Math.max(p, ramp(f, [c, c + 4, c + 8], [0, 5, 0])), 0);
  let rollPos = 0;
  for (const c of cues) rollPos += prog(f, c + DUR - 6, c + DUR + 2, Easing.bezier(0.25, 0.8, 0.25, 1));
  const counter = Math.min(prog(f, hi - 6, hi), 1 - prog(f, vault, vault + 10));
  const outline = ramp(f, [delivered - 2, delivered + 6, delivered + 30, delivered + 40], [0, 1, 1, 0]);
  const chip = prog(f, five - 4, five + 10);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <PageCam src="market-0" pageH={H} cam={cam}>
        {ROWS.map((r, i) => {
          const cue = cues[i] as number;
          const t = prog(f, cue, cue + DUR, Easing.bezier(0.45, 0.05, 0.25, 1.12));
          const settled = t >= 0.999;
          return (
            <React.Fragment key={i}>
              {f >= hi - 20 && !settled ? <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, background: "#161413" }} /> : null}
              {f >= cue && f >= hi - 20 ? (
                <Crop
                  src="market-0"
                  pageH={H}
                  rect={r}
                  style={{
                    transform: `translateY(${520 * (1 - t) + (settled ? press(i) : 0)}px) rotate(${(i % 2 ? -1.5 : 1.5) * (1 - t)}deg) scale(${1.05 - 0.05 * t})`,
                    boxShadow: settled ? "none" : `0 30px 60px rgba(0,0,0,${0.45 * (1 - t) + 0.1})`,
                    opacity: prog(f, cue, cue + 4),
                  }}
                />
              ) : null}
            </React.Fragment>
          );
        })}
        {outline > 0
          ? PAYS.map((p, i) => (
              <div key={i} style={{ position: "absolute", left: p.x - 2, top: p.y + 1, width: p.w + 4, height: p.h - 2, borderRadius: 8, boxShadow: `0 0 0 2px ${patina(0.8 * outline)}, 0 0 16px ${patina(0.4 * outline)}` }} />
            ))
          : null}
        <Marker f={f} at={hundred} x={990} y={rowCy + 14} w={52} />
        <Marker f={f} at={paid} x={1322} y={rowCy + 14} w={84} color={C.patina} />
        {f >= paid ? (
          <div style={{ position: "absolute", left: 1426, top: rowCy - 15, width: 82, height: 30, borderRadius: 15, boxShadow: `0 0 0 2px ${patina(ramp(f, [paid, paid + 8], [0, 0.9]))}, 0 0 20px ${patina(0.5 * ramp(f, [paid, paid + 8], [0, 1]))}` }} />
        ) : null}
        {chip > 0 ? (
          <div
            style={{
              position: "absolute",
              left: 640,
              top: HISTORY.y + HISTORY.h + 12,
              padding: "8px 16px",
              borderRadius: 10,
              background: "#1d1813",
              boxShadow: `0 0 0 1px ${bronze(0.6)}, 0 14px 30px rgba(0,0,0,0.5)`,
              fontFamily: SANS,
              fontSize: 22,
              color: C.fg,
              opacity: chip,
              transform: `translateY(${(1 - chip) * 10}px)`,
            }}
          >
            In round #1, veBTC <span style={{ fontFamily: MONO }}>#1714</span> reached <span style={{ color: C.bronze, fontWeight: 600 }}>5x</span>
          </div>
        ) : null}
      </PageCam>
      {counter > 0 ? (
        <div style={{ position: "absolute", top: 64, right: 96, textAlign: "right", opacity: counter, transform: `scale(${0.96 + 0.04 * counter})`, transformOrigin: "top right" }}>
          <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: "0.16em", color: C.muted, textTransform: "uppercase" }}>Bids in the book</div>
          <div style={{ display: "flex", justifyContent: "flex-end", height: 120, overflow: "hidden" }}>
            <div style={{ transform: `translateY(${-rollPos * 120}px)` }}>
              {(DIGITS + DIGITS).split("").map((d, j) => (
                <div key={j} style={{ fontFamily: MONO, fontWeight: 700, fontSize: 104, lineHeight: "120px", color: C.bronze }}>
                  {d}
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontFamily: SANS, fontSize: 32, color: C.muted }}>highest fills first</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
