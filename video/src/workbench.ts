// Workbench manifest: how the film breaks into editable tracks for the shotcraft
// workbench (`node workbench/scripts/open.mjs <this project>`). Every table is
// imported from the timeline, Main and sound, so there is no second copy of timing.
// Motion (cues, eases, camera keys) is deliberately not exposed.
import { createElement, type FC } from "react";
import { CaptionTrack, Flash, Main, SCENES } from "./Main";
import { PAD, ShotSequence } from "./shot";
import { SFX } from "./sound";
import { C } from "./theme";
import { SHOTS, TOTAL, type BeatId } from "./timeline";

/** One shot as a clip: its local frame 0 is PAD frames before the slot, as in Main. */
const ShotUnit: FC<{ id?: BeatId }> = ({ id = "hook" }) => {
  const s = SHOTS.find((x) => x.id === id);
  if (!s) return null;
  return createElement(ShotSequence, { shot: { ...s, from: PAD }, children: createElement(SCENES[id]) });
};
ShotUnit.displayName = "Shot";

const CaptionUnit: FC<{ id?: BeatId }> = ({ id = "problem" }) => createElement(CaptionTrack, { id });
CaptionUnit.displayName = "Captions";

export const WORKBENCH = {
  name: "Janus - the boost market for Mezo",
  fps: 30,
  width: 1920,
  height: 1080,
  total: TOTAL,
  background: C.bg,
  shots: SHOTS.map((s) => ({
    id: s.id,
    label: s.id,
    from: s.from - PAD,
    duration: s.dur + 2 * PAD,
    component: ShotUnit,
    props: { id: s.id },
    cardId: `shot-${s.id}`,
  })),
  transitions: SHOTS.filter((s) => s.out === "flash").map((s) => ({
    id: `flash-${s.id}`,
    label: "flash",
    from: s.from + s.dur - 5,
    duration: 10,
    component: Flash,
    cardId: "flash",
  })),
  captions: SHOTS.filter((s) => s.captions).map((s) => ({
    id: `cap-${s.id}`,
    label: `captions ${s.id}`,
    from: s.from + s.pre,
    duration: s.dur - s.pre,
    component: CaptionUnit,
    props: { id: s.id },
    cardId: "captions",
  })),
  overlays: [],
  sfx: [
    ...SHOTS.map((s) => ({ from: s.from + s.pre, duration: s.dur - s.pre, src: `audio/${s.id}.mp3`, volume: 1 })),
    ...SFX.map((s) => ({ from: Math.max(0, s.from), duration: s.dur ?? 90, src: `audio/${s.src}`, volume: s.volume })),
  ],
  bgm: [{ from: 0, duration: TOTAL, src: "audio/bgm.mp3", volume: 0.13 }],
  order: ["transitions", "captions", "overlays"],
  original: Main,
};
