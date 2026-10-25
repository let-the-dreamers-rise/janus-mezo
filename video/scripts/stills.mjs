// QA stills: bundles once, renders each requested frame to out/qa/<tag>/f<frame>.png.
// Usage (from video/): node scripts/stills.mjs <tag> <frame> [frame...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [tag = "v1", ...frames] = process.argv.slice(2);
const out = join(root, "out", "qa", tag);
mkdirSync(out, { recursive: true });

const browserExecutable = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts") });
const composition = await selectComposition({ serveUrl, id: "JanusDemo", inputProps: { bgm: true }, browserExecutable });
for (const f of frames.map(Number)) {
  await renderStill({ serveUrl, composition, frame: f, output: join(out, `f${f}.png`), inputProps: { bgm: true }, browserExecutable });
  console.log("still", f);
}
