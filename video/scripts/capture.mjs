// Captures the live Janus app as 2x full-page textures plus a layout inventory, walking the
// judge path for real on matsnet: demo wallet, starter kit, gauge, bid, then Market, Earn, Home.
// Usage (from video/): node scripts/capture.mjs [BASE]
// Writes public/textures/<state>.png and src/layout.json ({ [state]: { pageH, items[] } }).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "https://janus-mezo.vercel.app";
const OWNER = "0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = join(here, "..", "public", "textures");
const LAYOUT = join(here, "..", "src", "layout.json");
const INVENTORY = "h1,h2,h3,button,a,li,dt,dd,tr,form,section,aside,label,input,[role=group],[role=status],p";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  reducedMotion: "reduce",
});
await context.addInitScript(() => localStorage.setItem("janus.intro.seen.v1", "1"));
const page = await context.newPage();
const layout = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function settle(ms = 1500) {
  await page.evaluate(() => document.fonts.ready);
  await sleep(ms);
}

/// Full-page 2x texture plus every visible element's page-space box and text.
async function snap(name) {
  await page.mouse.move(0, 0);
  await settle(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  const pageH = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  const items = await page.$$eval(INVENTORY, (els) =>
    els
      .map((e, i) => {
        const r = e.getBoundingClientRect();
        const text = (e.innerText ?? e.value ?? "").replace(/\s+/g, " ").trim().slice(0, 90);
        return { i, tag: e.tagName.toLowerCase(), id: e.id || undefined, text, x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
      })
      .filter((b) => b.w > 2 && b.h > 2),
  );
  layout[name] = { pageH, items };
  log("snap", name, pageH, items.length);
}

const button = (name) => page.getByRole("button", { name, exact: false }).first();
const waitText = (text, timeout = 90_000) => page.getByText(text, { exact: false }).first().waitFor({ timeout });

try {
  // Judge path: /start/
  await page.goto(`${BASE}/start/`);
  await waitText("Your checklist");
  await snap("start-0");
  await button("Try with a demo wallet").click();
  await button("Get the starter kit").waitFor({ timeout: 30_000 });
  await settle(2500);
  await snap("start-1");
  await button("Get the starter kit").click();
  await waitText("Sent to your wallet");
  const kit = page.locator("#starter-kit");
  if (!(await kit.getByText("veBTC NFT #").count())) {
    log("veBTC missing, asking again");
    await button("Get the starter kit").click();
    await kit.getByText("veBTC NFT #").first().waitFor({ timeout: 90_000 });
  }
  await settle(4000);
  await snap("start-2");

  // Bronze face: gauge, quick picks, bid
  await page.goto(`${BASE}/boost/`);
  await button("Create boost gauge").waitFor({ timeout: 60_000 });
  await settle();
  await snap("boost-0");
  await button("Create boost gauge").click();
  await button("Place bid").waitFor({ timeout: 90_000 });
  await settle(2500);
  await snap("boost-1");
  await button("Top +10%").click();
  await button("Use 4 rounds").click();
  await settle();
  await snap("boost-2");
  await page.locator('button[type="submit"]').click();
  await page.locator('button[type="submit"]', { hasText: "Place bid" }).waitFor({ timeout: 90_000 });
  await settle(2000);
  await page.locator('button[type="submit"]').click();
  await waitText("Escrow left");
  await settle(3000);
  await snap("boost-3");

  // Market, Earn (seeded account, read-only), Home
  await page.goto(`${BASE}/market/`);
  await waitText("Paid out");
  await settle(3000);
  await snap("market-0");
  await page.goto(`${BASE}/earn/?as=${OWNER}`);
  await page.locator("#shards-title").waitFor({ timeout: 60_000 });
  await settle(4000);
  await snap("earn-0");
  await page.goto(`${BASE}/`);
  await page.locator("#mezo-title").waitFor({ timeout: 60_000 });
  await settle(3000);
  await snap("home-0");
} finally {
  writeFileSync(LAYOUT, JSON.stringify(layout));
  log("wrote layout", Object.keys(layout).join(", "));
  await browser.close();
}
