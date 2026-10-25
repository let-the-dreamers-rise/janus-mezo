// The Janus mark: a split coin, bronze half (the Bitcoin face) and patina half (the MEZO face).
// `draw` 0..1 draws the rim; `fill` 0..1 reveals both halves from the seam outward;
// `split` 0..1 pulls the halves apart (the rim fades as they part).
import React, { useId } from "react";
import { C } from "../theme";

const R = 50;
const INNER = 41;
const GAP = 3;

export const CoinMark: React.FC<{
  readonly size: number;
  readonly draw?: number;
  readonly fill?: number;
  readonly split?: number;
  readonly style?: React.CSSProperties;
}> = ({ size, draw = 1, fill = 1, split = 0, style }) => {
  const id = useId().replace(/:/g, "");
  const s = split * 40;
  const w = INNER * fill;
  return (
    <svg width={size} height={size} viewBox="-60 -60 120 120" style={{ overflow: "visible", ...style }}>
      <defs>
        <clipPath id={`${id}l`}>
          <rect x={-GAP / 2 - w} y={-60} width={w} height={120} />
        </clipPath>
        <clipPath id={`${id}r`}>
          <rect x={GAP / 2} y={-60} width={w} height={120} />
        </clipPath>
      </defs>
      <circle
        r={R}
        fill="none"
        stroke="hsl(36 10% 34%)"
        strokeWidth={6}
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={100 * (1 - draw)}
        transform="rotate(-90)"
        strokeLinecap="round"
        opacity={1 - split}
      />
      <g transform={`translate(${-s}, 0)`}>
        <path
          d={`M ${-GAP / 2} ${-INNER} A ${INNER} ${INNER} 0 0 0 ${-GAP / 2} ${INNER} Z`}
          fill={C.bronze}
          clipPath={`url(#${id}l)`}
        />
      </g>
      <g transform={`translate(${s}, 0)`}>
        <path
          d={`M ${GAP / 2} ${-INNER} A ${INNER} ${INNER} 0 0 1 ${GAP / 2} ${INNER} Z`}
          fill={C.patina}
          clipPath={`url(#${id}r)`}
        />
      </g>
    </svg>
  );
};
