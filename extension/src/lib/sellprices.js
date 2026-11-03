// Sell prices for Home: the lowest Buff163 and CSFloat listing for every item
// the user currently owns, so they can compare where to sell.
//
// Fetched here, from the user's own browser, because the server can't:
// CSFloat rate-limits Vercel's many IPs, and Buff163 only answers a logged-in
// browser session (the user must be signed in on buff.163.com in Chrome).
//
// Each poll asks the backend which names it owns and how old each price is,
// refreshes the stalest few per market (gently spaced), and pushes the results.
// The site hides anything older than an hour, so prices are refreshed once
// they are REFRESH_AFTER_MS old.

import {
  BUFF_GOODS_SEARCH_URL,
  CSFLOAT_LISTINGS_API,
  SELL_PRICES_PER_RUN,
  SELL_PRICES_REFRESH_AFTER_MS,
  SELL_PRICES_RETRY_ERROR_MS,
} from './config.js';
import { getSellPriceState, pushSellPrices } from './skinroi.js';

const MARKETS = {
  buff163: { fetch: fetchBuffPrice, gapMs: 3000 },
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
  const names = Array.isArray(state?.names) ? state.names : [];
  if (!names.length) return { skipped: 'no_items' };

  const now = Date.now();
  const results = [];
  const status = {};

  await Promise.all(
    Object.entries(MARKETS).map(async ([market, { fetch: fetchPrice, gapMs }]) => {
      const due = dueNames(names, state.prices, market, now);
      if (!due.length) return;
      let ok = 0;
      for (let i = 0; i < due.length; i++) {
        if (i > 0) await sleep(gapMs);
        try {
          results.push({ name: due[i], market, ...(await fetchPrice(due[i])) });
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
    })
  );

  if (!results.length && !Object.keys(status).length) return { skipped: 'fresh' };
  await pushSellPrices({ results, status });
  return { pushed: results.length, status };
}

// ── Buff163 ────────────────────────────────────────────────────────────────
// The goods search returns sell_min_price (CNY) and sell_num per item. Only
// an exact market_hash_name match counts (search also returns StatTrak etc.).
async function fetchBuffPrice(name) {
  const url = `${BUFF_GOODS_SEARCH_URL}&search=${encodeURIComponent(name)}`;
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 429) throw new MarketError('Buff163 rate limited, retrying later');
  if (!res.ok) throw new MarketError(`Buff163 HTTP ${res.status}`);
  const json = await res.json().catch(() => null);
  if (json?.code === 'Login Required') {
    throw new MarketError('Not signed in to buff.163.com in this browser');
  }
  if (json?.code !== 'OK') throw new MarketError(`Buff163: ${json?.msg || json?.code || 'unexpected answer'}`);
  const hit = (json.data?.items || []).find((g) => g?.market_hash_name === name);
  if (!hit) throw new Error('not found on Buff163');
  const count = Number(hit.sell_num) || 0;
  return { priceCny: count > 0 ? Number(hit.sell_min_price) : null, count };
}

// ── CSFloat ────────────────────────────────────────────────────────────────
// Cheapest buy-now listing for the exact name. Price is USD cents.
async function fetchCsfloatPrice(name) {
  const params = new URLSearchParams({
    market_hash_name: name,
    sort_by: 'lowest_price',
    type: 'buy_now',
    limit: '1',
  });
  const res = await fetch(`${CSFLOAT_LISTINGS_API}?${params}`, { credentials: 'include' });
  if (res.status === 429) throw new MarketError('CSFloat rate limited, retrying later');
  if (res.status === 401 || res.status === 403) {
    throw new MarketError(`CSFloat HTTP ${res.status} (signed in to csfloat.com?)`);
  }
  if (!res.ok) throw new Error(`CSFloat HTTP ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json) ? json : json?.data || [];
  const cheapest = rows.find((l) => l?.item?.market_hash_name === name && l.price > 0);
  return cheapest ? { priceUsd: cheapest.price / 100 } : { priceUsd: null, count: 0 };
}
