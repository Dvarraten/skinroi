// Takes the landing page screenshots (public/landing/*.webp) from the demo.
// The demo is all local data, so this needs no login, no Redis and no API:
// only the frontend and a network that can reach Steam's image CDN.
//
//   npm start                                   (in one terminal)
//   npm i --no-save playwright                  (once)
//   npx playwright install chromium             (once)
//   npm run landing:shots                       (in another terminal)
//
// Options (environment variables): SKINROI_URL (default http://localhost:3000),
// SHOTS_THEME=light for Light mode. Writes overview, portfolio (Analytics),
// handle (Trades) and snipes .webp at 1440x820, like the current ones.
const path = require('path');
const fs = require('fs');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is missing. Run: npm i --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const BASE = process.env.SKINROI_URL || 'http://localhost:3000';
const THEME = process.env.SHOTS_THEME === 'light' ? 'light' : 'dark';
const OUT = process.env.SHOTS_OUT || path.join(__dirname, '..', 'public', 'landing');
const VIEWPORT = { width: 1440, height: 820 };

// [file, sidebar button to open the page]
const SHOTS = [
  ['overview', 'Portfolio'],
  ['portfolio', 'Analytics'],
  ['handle', 'Trades'],
  ['snipes', 'Snipes'],
];

async function waitForImages(page) {
  // Every <img> on screen loaded (or failed), then a moment for fades.
  await page.waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 20000 })
    .catch(() => console.warn('  some images did not finish loading'));
  const broken = await page.evaluate(() => [...document.images]
    .filter((img) => img.complete && img.naturalWidth === 0 && img.getBoundingClientRect().width > 0)
    .map((img) => img.src));
  if (broken.length) console.warn(`  ${broken.length} image(s) failed, e.g. ${broken[0].slice(0, 90)}…`);
  await page.waitForTimeout(600);
}

// Playwright saves PNG or JPEG only, so the page's own canvas encodes WebP.
async function toWebp(page, png) {
  const dataUrl = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/webp', 0.86);
  }, png.toString('base64'));
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await page.addInitScript((theme) => {
    sessionStorage.setItem('skinroi-demo', '1');
    localStorage.setItem('cs2-theme', theme);
    localStorage.setItem('skinroi-view-mode', 'grid');
    localStorage.setItem('skinroi-handle-view', 'list');
  }, THEME);

  await page.goto(BASE, { waitUntil: 'networkidle' });
  const nav = page.getByRole('navigation', { name: 'Main' }).first();

  for (const [file, label] of SHOTS) {
    await nav.getByRole('button', { name: label, exact: false }).first().click();
    // The demo strip says "Demo"; the landing page shouldn't.
    await page.evaluate(() => document.querySelector('[data-demo-banner]')?.remove());
    await page.mouse.move(0, VIEWPORT.height - 1);
    await waitForImages(page);
    const png = await page.screenshot();
    const out = path.join(OUT, `${file}.webp`);
    fs.writeFileSync(out, await toWebp(page, png));
    console.log(`saved ${path.relative(process.cwd(), out)}`);
  }

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
