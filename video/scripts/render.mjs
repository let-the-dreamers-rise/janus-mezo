// Renders the full film. Usage: node scripts/render.mjs <out.mp4> [--no-bgm]
// Uses the installed Chrome so no headless-shell download is needed.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [outArg = "out/janus-demo.mp4", flag] = process.argv.slice(2);
const inputProps = { bgm: flag !== "--no-bgm" };
const browserExecutable = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts") });
const composition = await selectComposition({ serveUrl, id: "JanusDemo", inputProps, browserExecutable });
let last = -1;
await renderMedia({
  serveUrl,
  composition,
  inputProps,
  browserExecutable,
  codec: "h264",
  crf: 16,
  audioBitrate: "320k",
  outputLocation: resolve(root, outArg),
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== last) {
      last = pct;
      console.log(`render ${pct}%`);
    }
  },
});
console.log("done", outArg);
