// Word-timed narration captions (rule Q11: >= 56 px effective height). Words group into short
// phrases; spoken words are full white, the coming ones wait at 40%.
import React from "react";
import { AbsoluteFill } from "remotion";
import { FPS, type Word } from "../timeline";
import { C, SANS, prog } from "../theme";

const MAX_WORDS = 7;
const GAP_S = 0.42;

interface Phrase {
  readonly words: readonly Word[];
  readonly start: number;
  readonly end: number;
}

export function phrases(words: readonly Word[]): readonly Phrase[] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const pause = next ? next.start - w.end : Infinity;
    if (cur.length >= MAX_WORDS || pause > GAP_S || !next) {
      out.push(cur);
      cur = [];
    }
  });
  return out.map((ws) => ({ words: ws, start: (ws[0] as Word).start, end: (ws[ws.length - 1] as Word).end }));
}

const SHOW = (text: string) => text.replace(/^veMEZO$/i, "veMEZO").replace(/^jMEZO$/i, "jMEZO");

export const Captions: React.FC<{ readonly words: readonly Word[]; readonly f: number }> = ({ words, f }) => {
  const t = f / FPS;
  const list = phrases(words);
  const idx = list.findIndex((p, i) => t >= p.start - 0.12 && t < ((list[i + 1]?.start ?? p.end + 0.6) - 0.12));
  const phrase = list[idx];
  if (!phrase) return null;
  const fIn = (phrase.start - 0.12) * FPS;
  const fOut = ((list[idx + 1]?.start ?? phrase.end + 0.6) - 0.12) * FPS;
  const vis = Math.min(prog(f, fIn, fIn + 5), 1 - prog(f, fOut - 5, fOut));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 330, background: "linear-gradient(transparent, rgba(8,6,5,0.72) 45%, rgba(8,6,5,0.92))" }} />
      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          bottom: 70,
          textAlign: "center",
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: 60,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          color: C.fg,
          opacity: vis,
          transform: `translateY(${(1 - prog(f, fIn, fIn + 6)) * 10}px)`,
          textShadow: "0 2px 18px rgba(0,0,0,0.6)",
        }}
      >
        <span style={{ background: "rgba(14,13,12,0.8)", padding: "6px 22px", borderRadius: 14, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
          {phrase.words.map((w, i) => (
            <span key={i} style={{ opacity: t >= w.start - 0.05 ? 1 : 0.4 }}>
              {SHOW(w.text)}
              {i < phrase.words.length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      </div>
    </AbsoluteFill>
  );
};
