// SkinROI home worker: every POLL_MINUTES, fetch the newest CSFloat listings
// (Snipes) and stale sell prices (Portfolio) from a Playwright browser on this
// computer, and push them to SkinROI with the extension's Bearer secret.
//
//   npm start        run until Ctrl+C
//   npm run once     one round, then exit (handy for testing)

import { config } from './config.js';
import { isChromeOpen } from './chrome-open.js';
import { createCsfloatPage } from './browser.js';
import { createGate } from './gate.js';
import { runSellPrices } from './sellprices.js';
import { runSnipes } from './snipes.js';
import { NotPairedError, createSkinroiClient } from './skinroi.js';
import { fileStore } from './state.js';

const once = process.argv.includes('--once');
const log = (...a) => console.log(new Date().toLocaleTimeString('sv-SE'), ...a);

const secret = config.secret || fileStore('pairing').read().secret || '';
if (!secret) {
  console.error('Not paired. Put SKINROI_SECRET in worker/.env, or run: npm run pair -- ABCD-EFGH');
  process.exit(1);
}
if (config.browserChannel === 'chrome' && config.skipWhenChromeOpen && process.platform === 'win32') {
  log('BROWSER_CHANNEL=chrome: the worker would see its own Chrome as "open", so SKIP_WHEN_CHROME_OPEN is off.');
  config.skipWhenChromeOpen = false;
}

const skinroi = createSkinroiClient({ baseUrl: config.skinroiUrl, secret });
let csf = null;
const gate = createGate({ store: fileStore('csfloat-gate'), doFetch: (path) => csf.pageFetch(path) });
csf = createCsfloatPage({ gate, log });
const csfetch = (path) => gate.fetch(path);

async function round() {
  if (config.skipWhenChromeOpen && (await isChromeOpen())) {
    log('Chrome is open, the extension handles this round.');
    // Free the memory while we wait; the tab is reopened when needed.
    if (csf.isOpen()) await csf.close();
    return;
  }
  const paused = gate.pausedUntil();
  if (paused) {
    log(`CSFloat paused until ${new Date(paused).toLocaleTimeString('sv-SE')} (rate limit).`);
    return;
  }
  await csf.prepare();
  const jobs = [];
  if (config.runSnipes) jobs.push(['snipes', runSnipes]);
  if (config.runSellPrices) jobs.push(['sell prices', runSellPrices]);
  for (const [name, job] of jobs) {
    try {
      const { summary, error } = await job({ csfetch, skinroi });
      log(summary + (error ? ` (${error})` : ''));
    } catch (err) {
      if (err instanceof NotPairedError) throw err;
      log(`${name} failed: ${err.message || err}`);
    }
  }
}

let stopping = false;
async function shutdown(code = 0) {
  stopping = true;
  await csf.close();
  process.exit(code);
}
process.on('SIGINT', () => { log('Stopping…'); shutdown(0); });

async function main() {
  log(`SkinROI worker → ${config.skinroiUrl}, every ${config.pollMinutes} min${config.headless ? '' : ' (window visible)'}`);
  while (!stopping) {
    const started = Date.now();
    try {
      await round();
    } catch (err) {
      if (err instanceof NotPairedError) {
        console.error(`SkinROI refused the secret: ${err.message}. Pair again (see README).`);
        return shutdown(1);
      }
      log(`round failed: ${err.message || err}`);
      // A crashed browser is reopened next round.
      await csf.close();
    }
    if (once) return shutdown(0);
    const wait = Math.max(30_000, config.pollMinutes * 60_000 - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
  }
}

main();
