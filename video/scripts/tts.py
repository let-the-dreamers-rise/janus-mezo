"""Synthesises each narration beat with edge-tts and keeps word timings for captions.

Usage: python -I scripts/tts.py   (from video/). Writes public/audio/<id>.mp3 and src/timings.json.
"""
import asyncio
import json
import pathlib

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICE = "en-US-AndrewMultilingualNeural"
RATE = "+8%"
PITCH = "+2Hz"
TICKS = 10_000_000  # edge-tts offsets are in 100 ns ticks


async def synth(beat: dict, out_dir: pathlib.Path) -> dict:
    words = []
    audio = bytearray()
    talk = edge_tts.Communicate(beat["text"], VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary")
    async for chunk in talk.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            start = chunk["offset"] / TICKS
            words.append({"text": chunk["text"], "start": round(start, 3), "end": round(start + chunk["duration"] / TICKS, 3)})
    (out_dir / f"{beat['id']}.mp3").write_bytes(bytes(audio))
    return {"id": beat["id"], "words": words}


async def main() -> None:
    beats = json.loads((ROOT / "narration.json").read_text(encoding="utf-8"))
    out_dir = ROOT / "public" / "audio"
    out_dir.mkdir(parents=True, exist_ok=True)
    results = [await synth(beat, out_dir) for beat in beats]
    (ROOT / "src").mkdir(exist_ok=True)
    (ROOT / "src" / "timings.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    for r in results:
        print(r["id"], r["words"][-1]["end"] if r["words"] else "no words")


asyncio.run(main())
