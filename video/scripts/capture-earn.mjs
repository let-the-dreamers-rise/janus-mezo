// Re-captures only /earn/ for the seeded holder, in a fresh context with no demo wallet,
// so "Your position" shows the account's real jMEZO and claimable MUSD.
// Usage (from video/): node scripts/capture-earn.mjs [BASE]. Merges into src/layout.json.
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "https://janus-mezo.vercel.app";
const OWNER = "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = join(here, "..", "public", "textures", "earn-0.png");
const LAYOUT = join(here, "..", "src", "layout.json");
const INVENTORY = "h1,h2,h3,button,a,li,dt,dd,tr,form,section,aside,label,input,[role=group],[role=status],p";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("janus.intro.seen.v1", "1"));
  const page = await context.newPage();
  await page.goto(`${BASE}/earn/?as=${OWNER}`);
  await page.locator("#shards-title").waitFor({ timeout: 60_000 });
  await page.getByText("100 jMEZO", { exact: false }).nth(1).waitFor({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 4000));
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  const pageH = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: OUT, fullPage: true });
  const items = await page.$$eval(INVENTORY, (els) =>
    els
      .map((e, i) => {
        const r = e.getBoundingClientRect();
        const text = (e.innerText ?? e.value ?? "").replace(/\s+/g, " ").trim().slice(0, 90);
        return { i, tag: e.tagName.toLowerCase(), id: e.id || undefined, text, x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
      })
      .filter((b) => b.w > 2 && b.h > 2),
  );
  const layout = JSON.parse(readFileSync(LAYOUT, "utf8"));
  writeFileSync(LAYOUT, JSON.stringify({ ...layout, "earn-0": { pageH, items } }));
  console.log("earn-0", pageH, items.length);
  console.log((await page.locator("main").innerText()).slice(0, 700));
} finally {
  await browser.close();
}
