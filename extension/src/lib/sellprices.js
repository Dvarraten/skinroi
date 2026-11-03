// Sell prices for Home: the lowest CSFloat listing for every item the user
// currently owns. (YouPin prices come from SteamDT on the server.)
//
// Fetched here, from the user's own browser, because CSFloat rate-limits
// Vercel's many IPs. Each poll asks the backend which names it owns and how
// old each price is, refreshes the stalest few (gently spaced), and pushes
// the results. The site hides anything older than an hour.

import {
  CSFLOAT_LISTINGS_API,
  SELL_PRICES_PER_RUN,
  SELL_PRICES_REFRESH_AFTER_MS,
  SELL_PRICES_RETRY_ERROR_MS,
} from './config.js';
import { getSellPriceState, pushSellPrices } from './skinroi.js';

// Markets priced one item per request.
const PER_ITEM_MARKETS = {
  csfloat: { fetch: fetchCsfloatPrice, gapMs: 2000 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A failure that applies to the whole market (not logged in, rate limited),
// so there is no point trying the next item this run.
class MarketError extends Error {}

// Picks the names whose price for `market` is missing or getting old.
export function dueNames(names, prices, market, now) {
  const due = [];
  for (const name of names) {
    const p = prices?.[name]?.[market];
    if (!p) { due.push({ name, age: Infinity }); continue; }
    const age = now - (p.at || 0);
    const sinceCheck = now - (p.checkedAt || 0);
    if (p.error && sinceCheck < SELL_PRICES_RETRY_ERROR_MS) continue;
    if (age >= SELL_PRICES_REFRESH_AFTER_MS) due.push({ name, age });
  }
  return due.sort((a, b) => b.age - a.age).slice(0, SELL_PRICES_PER_RUN).map((d) => d.name);
}

export async function runSellPrices() {
  const state = await getSellPriceState();
  const targets = new Map((Array.isArray(state?.targets) ? state.targets : []).map((t) => [t.key, t]));
  const names = [...targets.keys()];
  if (!names.length) return { skipped: 'no_items' };

  const now = Date.now();
  const results = [];
  const status = {};

  await Promise.all([
    ...Object.entries(PER_ITEM_MARKETS).map(async ([market, { fetch: fetchPrice, gapMs }]) => {
      const due = dueNames(names, state.prices, market, now);
      if (!due.length) return;
      let ok = 0;
      for (let i = 0; i < due.length; i++) {
        if (i > 0) await sleep(gapMs);
        try {
          results.push({ name: due[i], market, ...(await fetchPrice(targets.get(due[i]))) });
          ok++;
        } catch (err) {
          if (err instanceof MarketError) {
            status[market] = err.message;
            return;
          }
          results.push({ name: due[i], market, error: err.message || String(err) });
        }
      }
      if (ok > 0) status[market] = null;
    }),
  ]);

  if (!results.length && !Object.keys(status).length) return { skipped: 'fresh' };
  await pushSellPrices({ results, status });
  return { pushed: results.length, status };
}

// ── CSFloat ────────────────────────────────────────────────────────────────
// Cheapest buy-now listing for the exact name. Price is USD cents.
// Dopplers are looked up per phase through CSFloat's paint_index filter: the
// item's own paint index when known, else each index that phase can have
// (older vs newer knives, Glock Gamma Doppler) until one has listings.
const PHASE_PAINT_INDEXES = {
  Doppler: {
    'Phase 1': [418, 852], 'Phase 2': [419, 853], 'Phase 3': [420, 854], 'Phase 4': [421, 855],
    Ruby: [415], Sapphire: [416], 'Black Pearl': [417],
  },
  'Gamma Doppler': {
    'Phase 1': [569, 1120], 'Phase 2': [570, 1121], 'Phase 3': [571, 1122], 'Phase 4': [572, 1123],
    Emerald: [568, 1119],
  },
};

async function fetchCsfloatPrice(target) {
  const { name, phase, paintIndex } = target;
  const isDoppler = /\bDoppler\b/.test(name);
  if (!isDoppler) return cheapestCsfloat(name, null);
  // Phase unknown: lowest listing of any phase, flagged so the site says so.
  if (!phase) return { ...(await cheapestCsfloat(name, null)), anyPhase: true };
  const finish = /\bGamma Doppler\b/.test(name) ? 'Gamma Doppler' : 'Doppler';
  const indexes = paintIndex != null ? [paintIndex] : PHASE_PAINT_INDEXES[finish][phase] || [];
  for (const idx of indexes) {
    const hit = await cheapestCsfloat(name, idx);
    if (hit.priceUsd != null) return hit;
  }
  // Nothing listed for that phase (or the filter didn't match): fall back to
  // the lowest of any phase rather than showing nothing.
  return { ...(await cheapestCsfloat(name, null)), anyPhase: true };
}

async function cheapestCsfloat(name, paintIndex) {
  const params = new URLSearchParams({
    market_hash_name: name,
    sort_by: 'lowest_price',
    type: 'buy_now',
    limit: '1',
  });
  if (paintIndex != null) params.set('paint_index', String(paintIndex));
  const res = await fetch(`${CSFLOAT_LISTINGS_API}?${params}`, { credentials: 'include' });
  if (res.status === 429) throw new MarketError('CSFloat rate limited, retrying later');
  if (res.status === 401 || res.status === 403) {
    throw new MarketError(`CSFloat HTTP ${res.status} (signed in to csfloat.com?)`);
  }
  if (!res.ok) throw new Error(`CSFloat HTTP ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json) ? json : json?.data || [];
  const cheapest = rows.find((l) =>
    l?.item?.market_hash_name === name && l.price > 0 &&
    (paintIndex == null || l.item.paint_index == null || l.item.paint_index === paintIndex));
  return cheapest ? { priceUsd: cheapest.price / 100 } : { priceUsd: null, count: 0 };
}
