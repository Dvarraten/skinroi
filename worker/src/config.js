// Settings for the home worker. Values come from worker/.env (see
// .env.example) or real environment variables, which win.
//
// The CSFloat numbers mirror extension/src/lib/config.js on purpose: the worker
// does the extension's CSFloat work from the same home IP, so it must stay
// inside the same budget (CSFloat allows about 5 listings calls a minute).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WORKER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PROFILE_DIR = join(WORKER_DIR, '.profile');
export const STATE_DIR = join(WORKER_DIR, '.state');
export const WORKER_VERSION = 'worker-0.1.0';

// Minimal .env reader (KEY=value, # comments), so no dotenv dependency.
export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

function loadEnv() {
  let fileEnv = {};
  try {
    fileEnv = parseEnv(readFileSync(join(WORKER_DIR, '.env'), 'utf8'));
  } catch {
    // No .env: defaults + real environment variables.
  }
  return { ...fileEnv, ...process.env };
}

const env = loadEnv();
const flag = (v, dflt) => (v == null || v === '' ? dflt : !/^(0|false|no|off)$/i.test(v));

export const config = {
  skinroiUrl: (env.SKINROI_URL || 'https://www.skinroi.com').replace(/\/+$/, ''),
  secret: env.SKINROI_SECRET || '',
  pollMinutes: Math.max(5, Number(env.POLL_MINUTES) || 5),
  headless: flag(env.HEADLESS, true),
  browserChannel: env.BROWSER_CHANNEL || undefined,
  // Only for tests: a fake CSFloat on localhost, and a fixed browser binary.
  csfloatOrigin: (env.CSFLOAT_ORIGIN || 'https://csfloat.com').replace(/\/+$/, ''),
  executablePath: env.BROWSER_EXECUTABLE || undefined,
  skipWhenChromeOpen: flag(env.SKIP_WHEN_CHROME_OPEN, true),
  runSnipes: flag(env.RUN_SNIPES, true),
  runSellPrices: flag(env.RUN_SELL_PRICES, true),
};

// ── CSFloat budget (same as the extension) ──────────────────────────────────
// One queue for every call, 18 s apart (at most 3 a minute). After a 429 all
// calls pause until Retry-After / X-RateLimit-Reset, else 10 min doubling to
// 60 min. Per round: 1 feed + 2 lookups + 3 sell-price calls = 6.
export const CSFLOAT_MIN_GAP_MS = 18 * 1000;
export const CSFLOAT_PAUSE_MIN_MS = 10 * 60 * 1000;
export const CSFLOAT_PAUSE_MAX_MS = 60 * 60 * 1000;
export const SNIPE_LOOKUPS_PER_RUN = 2;
export const SELL_PRICES_CALLS_PER_RUN = 3;
export const SELL_PRICES_REFRESH_AFTER_MS = 48 * 60 * 60 * 1000;
export const SELL_PRICES_RETRY_ERROR_MS = 10 * 60 * 1000;
// The csfloat.com tab is reloaded this often (fresh cookies / Cloudflare pass).
export const PAGE_RELOAD_MS = 6 * 60 * 60 * 1000;

export const csfloatListingsFeedPath =
  '/api/v1/listings?sort_by=most_recent&type=buy_now&limit=50';
export const csfloatListingsPath = '/api/v1/listings';
