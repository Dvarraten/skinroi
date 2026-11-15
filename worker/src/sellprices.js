// Sell prices for Portfolio: the lowest CSFloat listing for each owned item.
// Port of extension/src/lib/sellprices.js (keep the two in step): ask the
// server which names are due, refresh at most SELL_PRICES_CALLS_PER_RUN, push.

import {
  SELL_PRICES_CALLS_PER_RUN, SELL_PRICES_REFRESH_AFTER_MS, SELL_PRICES_RETRY_ERROR_MS, csfloatListingsPath,
} from './config.js';
import { CsfloatPausedError } from './gate.js';

class MarketError extends Error {}
class BudgetSpent extends Error {}

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
  return due.sort((a, b) => b.age - a.age).slice(0, SELL_PRICES_CALLS_PER_RUN).map((d) => d.name);
}

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

export async function runSellPrices({ csfetch, skinroi, now = Date.now() }) {
  const state = await skinroi.getSellPriceState();
  const targets = new Map((Array.isArray(state?.targets) ? state.targets : []).map((t) => [t.key, t]));
  const names = [...targets.keys()];
  if (!names.length) return { summary: 'sell prices: no items' };

  const due = dueNames(names, state.prices, 'csfloat', now);
  if (!due.length) return { summary: 'sell prices: all fresh' };

  const results = [];
  const status = {};
  const budget = { left: SELL_PRICES_CALLS_PER_RUN };
  let ok = 0;
  for (const key of due) {
    if (budget.left <= 0) break;
    try {
      results.push({ name: key, market: 'csfloat', ...(await csfloatPrice(targets.get(key), budget, csfetch)) });
      ok++;
    } catch (err) {
      if (err instanceof BudgetSpent) break;
      if (err instanceof MarketError) { status.csfloat = err.message; break; }
      results.push({ name: key, market: 'csfloat', error: err.message || String(err) });
    }
  }
  if (ok > 0 && status.csfloat === undefined) status.csfloat = null;
  if (!results.length && !Object.keys(status).length) return { summary: 'sell prices: nothing to push' };
  await skinroi.pushSellPrices({ results, status });
  return { summary: `sell prices: pushed ${results.length}`, error: status.csfloat || null };
}

async function csfloatPrice(target, budget, csfetch) {
  const { name, phase, paintIndex } = target;
  const cheapest = (n, idx) => cheapestListing(n, idx, budget, csfetch);
  if (!/\bDoppler\b/.test(name)) return cheapest(name, null);
  if (!phase) return { ...(await cheapest(name, null)), anyPhase: true };
  const finish = /\bGamma Doppler\b/.test(name) ? 'Gamma Doppler' : 'Doppler';
  const indexes = paintIndex != null ? [paintIndex] : PHASE_PAINT_INDEXES[finish][phase] || [];
  for (const idx of indexes) {
    const hit = await cheapest(name, idx);
    if (hit.priceUsd != null) return hit;
  }
  return { ...(await cheapest(name, null)), anyPhase: true };
}

async function cheapestListing(name, paintIndex, budget, csfetch) {
  if (budget.left <= 0) throw new BudgetSpent();
  budget.left--;
  const params = new URLSearchParams({ market_hash_name: name, sort_by: 'lowest_price', type: 'buy_now', limit: '1' });
  if (paintIndex != null) params.set('paint_index', String(paintIndex));
  let res;
  try {
    res = await csfetch(`${csfloatListingsPath}?${params}`);
  } catch (err) {
    if (err instanceof CsfloatPausedError) throw new MarketError(err.message);
    throw err;
  }
  if (res.status === 401 || res.status === 403) {
    throw new MarketError(`CSFloat HTTP ${res.status} (run npm run login?)`);
  }
  if (!res.ok) throw new Error(`CSFloat HTTP ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json) ? json : json?.data || [];
  const hit = rows.find((l) =>
    l?.item?.market_hash_name === name && l.price > 0 &&
    (paintIndex == null || l.item.paint_index == null || l.item.paint_index === paintIndex));
  return hit ? { priceUsd: hit.price / 100 } : { priceUsd: null, count: 0 };
}
