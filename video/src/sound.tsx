// The whole sound design lives here, as one declarative table pinned to the
// narration. Scenes carry no audio code. Every cue is shot-relative, so a
// re-timed voice line moves its sounds with it.
import { Audio, Sequence, interpolate, staticFile } from "remotion";
import { TOTAL, shot, wordF, type BeatId } from "./timeline";

type Sfx = { readonly from: number; readonly src: string; readonly volume: number; readonly dur?: number; readonly note: string };

const at = (id: BeatId, local: number): number => shot(id).from + local;
const w = (id: BeatId, text: string, offset = 0, nth = 0): number => at(id, wordF(id, text, nth) + offset);
const seam = (id: BeatId): number => shot(id).from;

const S = {
  soft: "sfx/transition-soft.mp3",
  fast: "sfx/whoosh-fast.mp3",
  big: "sfx/whoosh-big.mp3",
  quick: "sfx/swoosh-quick.mp3",
  snap: "sfx/transition-snap.mp3",
  click: "sfx/click-camera.mp3",
  pop: "sfx/pop.mp3",
  zoom: "sfx/impact-zoom-quick.mp3",
  riser: "sfx/riser-cine.mp3",
  impact: "sfx/impact-deep-whoosh.mp3",
  sparkle: "sfx/sparkle.mp3",
  shimmer: "sfx/shimmer-sparkle-sweep.mp3",
} as const;

export const SFX: readonly Sfx[] = [
  // hook: coin draws in, wordmark lands, kicker types
  { from: at("hook", 6), src: S.soft, volume: 0.4, note: "coin rim starts drawing" },
  { from: at("hook", 30), src: S.snap, volume: 0.45, note: "Janus wordmark settles" },
  { from: w("hook", "catch", 18), src: S.fast, volume: 0.35, note: "brand exits into the problem" },
  // problem: chore list snaps on each beat, then the stuck meter
  { from: w("problem", "manual", -10), src: S.quick, volume: 0.3, note: "headline lifts to a header" },
  { from: w("problem", "post"), src: S.pop, volume: 0.38, note: "list beat 1" },
  { from: w("problem", "chase"), src: S.pop, volume: 0.34, note: "list beat 2" },
  { from: w("problem", "poke"), src: S.pop, volume: 0.3, note: "list beat 3" },
  { from: w("problem", "every"), src: S.pop, volume: 0.27, note: "list beat 4" },
  { from: w("problem", "so", -4), src: S.soft, volume: 0.35, note: "meter rises in, list falls away" },
  // insight: focus seam, the $75 odometer locks
  { from: seam("insight") - 8, src: S.quick, volume: 0.3, note: "focus seam into the data beat" },
  { from: w("insight", "seventy", -22), src: S.fast, volume: 0.28, note: "odometer spins up" },
  { from: w("insight", "seventy", 4), src: S.snap, volume: 0.5, note: "$75 locks" },
  // janus: tunnel in, coin splits, cards flip
  { from: seam("janus"), src: S.big, volume: 0.4, note: "tunnel seam to the two faces" },
  { from: w("janus", "two", -4), src: S.quick, volume: 0.32, note: "coin splits into two cards" },
  { from: w("janus", "buy", -4), src: S.quick, volume: 0.3, note: "buy card flips" },
  { from: w("janus", "sell", -4), src: S.quick, volume: 0.3, note: "sell card flips" },
  // start: flash cut, two real clicks, the kit rows drop in
  { from: seam("start") - 5, src: S.soft, volume: 0.38, note: "flash cut into the live app" },
  { from: w("start", "click"), src: S.click, volume: 0.55, note: "demo wallet click with punch-in" },
  { from: w("start", "more", -6), src: S.quick, volume: 0.28, note: "camera slides to the kit" },
  { from: w("start", "more"), src: S.click, volume: 0.5, note: "kit button click" },
  { from: w("start", "gas"), src: S.pop, volume: 0.36, note: "gas row lands" },
  { from: w("start", "MUSD"), src: S.pop, volume: 0.32, note: "MUSD row lands" },
  { from: w("start", "veBTC"), src: S.pop, volume: 0.28, note: "veBTC row lands" },
  { from: w("start", "lock", 6), src: S.fast, volume: 0.3, note: "camera eases out" },
  // boost: whip seam, three clicks, the spotlight hero, approve and place
  { from: seam("boost") - 4, src: S.fast, volume: 0.45, note: "whip pan into Boost" },
  { from: w("boost", "gauge"), src: S.click, volume: 0.45, note: "gauge click" },
  { from: w("boost", "five"), src: S.click, volume: 0.42, note: "5x chip click" },
  { from: w("boost", "bid"), src: S.click, volume: 0.42, note: "Top +10% click" },
  { from: w("boost", "janus", -6), src: S.big, volume: 0.4, note: "hero card lifts and tilts" },
  { from: w("boost", "janus", 8), src: S.shimmer, volume: 0.3, dur: 60, note: "spotlight beam laps the card" },
  { from: w("boost", "approve"), src: S.click, volume: 0.5, note: "approve click" },
  { from: w("boost", "place"), src: S.click, volume: 0.52, note: "place bid click" },
  { from: w("boost", "place", 8), src: S.quick, volume: 0.28, note: "camera to the placed bid" },
  // market: focus seam, rows stack, the crash zoom on the history row
  { from: seam("market") - 8, src: S.quick, volume: 0.3, note: "focus seam into Market" },
  { from: w("market", "highest", -12), src: S.pop, volume: 0.32, note: "order rows stack up" },
  { from: w("market", "vault", -2), src: S.quick, volume: 0.28, note: "camera to Latest round" },
  { from: w("market", "round", -6, 1), src: S.fast, volume: 0.32, note: "wide pull before the crash zoom" },
  { from: w("market", "round", 4, 1), src: S.zoom, volume: 0.48, note: "crash zoom onto history row" },
  { from: w("market", "paid"), src: S.snap, volume: 0.4, note: "Paid out badge" },
  // earn: flash, coin flips to patina, sheen on claim
  { from: seam("earn") - 5, src: S.soft, volume: 0.35, note: "flash seam into Earn" },
  { from: w("earn", "flip", -2), src: S.quick, volume: 0.38, note: "coin flips bronze to patina" },
  { from: w("earn", "deposit", -4), src: S.quick, volume: 0.26, note: "camera to the vault tiles" },
  { from: w("earn", "claim"), src: S.shimmer, volume: 0.32, dur: 50, note: "single sheen across the tile" },
  // trust: contracts light up, test count reels
  { from: seam("trust") - 5, src: S.soft, volume: 0.35, note: "flash seam into trust" },
  { from: w("trust", "BoostVoter"), src: S.pop, volume: 0.3, note: "BoostVoter card lights" },
  { from: w("trust", "veBTC"), src: S.pop, volume: 0.28, note: "veBTC card lights" },
  { from: w("trust", "veMEZO"), src: S.pop, volume: 0.26, note: "veMEZO card lights" },
  { from: w("trust", "hundred", 4), src: S.snap, volume: 0.45, note: "125 locks" },
  // close: riser -> impact -> sparkle
  { from: seam("close") - 12, src: S.big, volume: 0.4, note: "tunnel seam to the close" },
  { from: w("close", "janus", -35), src: S.riser, volume: 0.42, dur: 40, note: "cards fly in, riser" },
  { from: w("close", "janus"), src: S.impact, volume: 0.6, note: "wordmark stamps, loudest beat" },
  { from: w("close", "try"), src: S.sparkle, volume: 0.32, dur: 100, note: "URL underline glint" },
];

const BGM_LEVEL = 0.13;

export const SoundTrack: React.FC<{ readonly bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm ? (
      <Audio
        src={staticFile("audio/bgm.mp3")}
        volume={(f) => interpolate(f, [0, 30, TOTAL - 70, TOTAL], [0, BGM_LEVEL, BGM_LEVEL, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
    ) : null}
    {SFX.map((s, i) => (
      <Sequence key={`${s.src}-${i}`} from={Math.max(0, s.from)} durationInFrames={s.dur ?? 90} layout="none">
        <Audio src={staticFile(`audio/${s.src}`)} volume={s.volume} />
      </Sequence>
    ))}
  </>
);
