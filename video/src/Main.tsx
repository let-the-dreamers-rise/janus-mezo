// The film: obsidian stage, ten shots handing over through their seams, word captions,
// narration, SFX and the optional music bed (`bgm` prop, so a no-music cut renders from the
// same timeline).
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Captions } from "./components/Captions";
import { ShotSequence } from "./shot";
import { SoundTrack } from "./sound";
import { C, bronze, patina, ramp } from "./theme";
import { SHOTS, type BeatId } from "./timeline";
import { Brand } from "./scenes/Brand";
import { Problem } from "./scenes/Problem";
import { Insight } from "./scenes/Insight";
import { Faces } from "./scenes/Faces";
import { Start } from "./scenes/Start";
import { Boost } from "./scenes/Boost";
import { Market } from "./scenes/Market";
import { Earn } from "./scenes/Earn";
import { Trust } from "./scenes/Trust";
import { Close } from "./scenes/Close";

export interface MainProps {
  readonly bgm: boolean;
  readonly [key: string]: unknown;
}

export const SCENES: Record<BeatId, React.FC> = {
  hook: Brand,
  problem: Problem,
  insight: Insight,
  janus: Faces,
  start: Start,
  boost: Boost,
  market: Market,
  earn: Earn,
  trust: Trust,
  close: Close,
};

/** Warm flash over a hard cut (FlashCut, toned for a dark film). */
export const Flash: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: ramp(f, [0, 4, 10], [0, 0.6, 0]),
        background: "radial-gradient(ellipse at 50% 45%, rgba(255,240,214,0.95), rgba(240,200,140,0.45) 55%, transparent 80%)",
      }}
    />
  );
};

export const Main: React.FC<MainProps> = ({ bgm }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <AbsoluteFill style={{ background: `radial-gradient(1100px 700px at 20% 10%, ${bronze(0.06)}, transparent 70%), radial-gradient(1100px 700px at 85% 95%, ${patina(0.05)}, transparent 70%)` }} />
    {SHOTS.map((s) => {
      const Scene = SCENES[s.id];
      return (
        <ShotSequence key={s.id} shot={s}>
          <Scene />
        </ShotSequence>
      );
    })}
    {SHOTS.filter((s) => s.out === "flash").map((s) => (
      <Sequence key={`flash-${s.id}`} from={s.from + s.dur - 5} durationInFrames={10}>
        <Flash />
      </Sequence>
    ))}
    {SHOTS.filter((s) => s.captions).map((s) => (
      <Sequence key={`cap-${s.id}`} from={s.from + s.pre} durationInFrames={s.dur - s.pre}>
        <CaptionTrack id={s.id} />
      </Sequence>
    ))}
    {SHOTS.map((s) => (
      <Sequence key={`vo-${s.id}`} from={s.from + s.pre} name={`vo ${s.id}`}>
        <Audio src={staticFile(`audio/${s.id}.mp3`)} />
      </Sequence>
    ))}
    <SoundTrack bgm={bgm} />
  </AbsoluteFill>
);

export const CaptionTrack: React.FC<{ id: BeatId }> = ({ id }) => {
  const f = useCurrentFrame();
  const s = SHOTS.find((x) => x.id === id);
  return s ? <Captions words={s.words} f={f} /> : null;
};
