// 2.5D camera over a 2x full-page capture (from video-shotcraft assets/lib/PageCam.tsx).
// Always takes the CSS `zoom` path so Chromium rasterises the 2x texture at the magnified
// size (aesthetic rule Q2), and the page sits on the obsidian stage as a lit sheet.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, EASE, lerp, prog } from "../theme";

export interface CamKey {
  readonly f: number;
  readonly cx: number;
  readonly cy: number;
  readonly zoom: number;
  readonly rotX?: number;
  readonly rotY?: number;
  readonly ease?: (t: number) => number;
}

export interface Cam {
  readonly cx: number;
  readonly cy: number;
  readonly zoom: number;
  readonly rotX: number;
  readonly rotY: number;
}

/** Camera state at frame `f`: eased between the surrounding keys (each key's `ease` drives the move into it). */
export function camAt(keys: readonly CamKey[], f: number): Cam {
  const first = keys[0] as CamKey;
  let a = first;
  let b = first;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i] as CamKey;
    if (k.f <= f) {
      a = k;
      b = (keys[i + 1] as CamKey | undefined) ?? k;
    }
  }
  if (f < first.f) b = first;
  const t = a === b ? 1 : prog(f, a.f, b.f, b.ease ?? EASE.cam);
  return {
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    zoom: lerp(a.zoom, b.zoom, t),
    rotX: lerp(a.rotX ?? 0, b.rotX ?? 0, t),
    rotY: lerp(a.rotY ?? 0, b.rotY ?? 0, t),
  };
}

export const texture = (name: string) => staticFile(`textures/${name}.png`);

export const PageCam: React.FC<{
  readonly src: string;
  readonly pageH: number;
  readonly cam: Cam;
  readonly children?: React.ReactNode;
  readonly blur?: number;
}> = ({ src, pageH, cam, children, blur = 0 }) => {
  const { cx, cy, zoom, rotX, rotY } = cam;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, perspective: `${1400 * zoom}px`, perspectiveOrigin: "960px 540px" }}>
        <div
          style={{
            position: "absolute",
            width: 1920,
            height: pageH,
            zoom,
            transform: `translate(${960 / zoom - cx}px, ${540 / zoom - cy}px) rotateY(${rotY}deg) rotateX(${rotX}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transformStyle: "preserve-3d",
            background: C.bg,
            borderRadius: 18,
            boxShadow: `0 0 0 1px ${C.border}, 0 50px 140px rgba(0,0,0,0.65)`,
            filter: blur > 0 ? `blur(${blur}px)` : undefined,
          }}
        >
          <Img src={texture(src)} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: pageH, borderRadius: 18 }} />
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** A whole other capture of the same page laid over the base texture (for state changes). */
export const Layer: React.FC<{ readonly src: string; readonly pageH: number; readonly opacity: number }> = ({ src, pageH, opacity }) =>
  opacity <= 0.001 ? null : (
    <Img src={texture(src)} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: pageH, opacity, borderRadius: 18 }} />
  );

/** A rectangle of a capture, cut out by background offset (never redrawn). */
export const Crop: React.FC<{
  readonly src: string;
  readonly pageH: number;
  readonly rect: { x: number; y: number; w: number; h: number };
  readonly style?: React.CSSProperties;
  readonly at?: { x: number; y: number };
}> = ({ src, pageH, rect, style, at }) => (
  <div
    style={{
      position: "absolute",
      left: at ? at.x : rect.x,
      top: at ? at.y : rect.y,
      width: rect.w,
      height: rect.h,
      backgroundImage: `url(${texture(src)})`,
      backgroundSize: `1920px ${pageH}px`,
      backgroundPosition: `${-rect.x}px ${-rect.y}px`,
      backgroundRepeat: "no-repeat",
      ...style,
    }}
  />
);
