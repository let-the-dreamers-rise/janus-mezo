// Renders the Janus split-coin mark as a 512x512 product icon: node scripts/icon.mjs <out.png>
import { chromium } from "playwright-core";

const out = process.argv[2] ?? "out/submission/icon.png";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="#0e0d0c"/>
<defs><clipPath id="l"><rect x="0" y="0" width="256" height="512"/></clipPath><clipPath id="r"><rect x="256" y="0" width="256" height="512"/></clipPath></defs>
<circle cx="256" cy="256" r="176" fill="#2a2520" stroke="#5a5249" stroke-width="14"/>
<circle cx="256" cy="256" r="140" fill="#d89d54" clip-path="url(#l)"/>
<circle cx="256" cy="256" r="140" fill="#5fbfa5" clip-path="url(#r)"/>
</svg>`;

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
  console.log("icon", out);
} finally {
  await browser.close();
}
