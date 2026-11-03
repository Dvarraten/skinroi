// Sell prices for Home: the lowest Buff163 and CSFloat listing for every item
// the user currently owns, so they can compare where to sell.
//
// Fetched here, from the user's own browser, because the server can't:
// CSFloat rate-limits Vercel's many IPs, and Buff163 only answers a logged-in
// browser session (the user must be signed in on buff.163.com in Chrome).
//
// Each poll asks the backend which names it owns and how old each price is,
// refreshes what is due, and pushes the results. The site hides anything
// older than an hour.
// - CSFloat: one request per item, the stalest few per poll, gently spaced.
// - Buff163: one request per 15 min (4 an hour, the user's limit). It reads
//   Buff's view of the user's Steam inventory, which carries the lowest Buff
//   listing for every item in it, so all owned items are priced at once.
//   Items not in the Steam inventory (e.g. still on trade hold elsewhere)
//   get no Buff price.

import {
  BUFF_INVENTORY_URL,
  BUFF_INVENTORY_INTERVAL_MS,
  CSFLOAT_LISTINGS_API,
  STORAGE_KEYS,
  SELL_PRICES_PER_RUN,
  SELL_PRICES_REFRESH_AFTER_MS,
  SELL_PRICES_RETRY_ERROR_MS,
} from './config.js';
import { getSellPriceState, pushSellPrices } from './skinroi.js';
import { get, set } from './storage.js';

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
  const names = Array.isArray(state?.names) ? state.names : [];
  if (!names.length) return { skipped: 'no_items' };

  const now = Date.now();
  const results = [];
  const status = {};

  await Promise.all([
    runBuff(names, results, status, now),
    ...Object.entries(PER_ITEM_MARKETS).map(async ([market, { fetch: fetchPrice, gapMs }]) => {
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
    }),
  ]);

  if (!results.length && !Object.keys(status).length) return { skipped: 'fresh' };
  await pushSellPrices({ results, status });
  return { pushed: results.length, status };
}

// ── Buff163 ────────────────────────────────────────────────────────────────
// At most one request per BUFF_INVENTORY_INTERVAL_MS, counted from the last
// attempt (failed ones too), so Buff never sees more than ~4 calls an hour.
async function runBuff(names, results, status, now) {
  const last = (await get([STORAGE_KEYS.BUFF_LAST_FETCH]))[STORAGE_KEYS.BUFF_LAST_FETCH] || 0;
  if (now - last < BUFF_INVENTORY_INTERVAL_MS) return;
  await set({ [STORAGE_KEYS.BUFF_LAST_FETCH]: now });
  try {
    const byName = await fetchBuffInventoryPrices();
    for (const name of names) {
      const hit = byName.get(name);
      results.push(hit
        ? { name, market: 'buff163', ...hit }
        : { name, market: 'buff163', error: 'not in your Steam inventory on Buff163' });
    }
    status.buff163 = null;
  } catch (err) {
    status.buff163 = err.message || String(err);
  }
}

// Buff's sell page data: the user's Steam inventory plus goods_infos, one
// entry per item type with sell_min_price (CNY, lowest listing) and sell_num.
// Returns Map(market_hash_name → { priceCny, count }).
async function fetchBuffInventoryPrices() {
  const res = await fetch(BUFF_INVENTORY_URL, { credentials: 'include' });
  if (res.status === 429) throw new Error('Buff163 rate limited, retrying in 15 min');
  if (!res.ok) throw new Error(`Buff163 HTTP ${res.status}`);
  const json = await res.json().catch(() => null);
  if (json?.code === 'Login Required') throw new Error('Not signed in to buff.163.com in this browser');
  if (json?.code !== 'OK') throw new Error(`Buff163: ${json?.msg || json?.error || json?.code || 'unexpected answer'}`);
  const infos = json.data?.goods_infos;
  if (!infos || typeof infos !== 'object') {
    throw new Error(`Buff163: no goods_infos (got ${Object.keys(json.data || {}).slice(0, 8).join(', ')})`);
  }
  const out = new Map();
  for (const g of Object.values(infos)) {
    if (!g?.market_hash_name) continue;
    const count = Number(g.sell_num);
    const price = Number(g.sell_min_price);
    out.set(g.market_hash_name, {
      priceCny: price > 0 && count !== 0 ? price : null,
      count: Number.isFinite(count) ? count : null,
    });
  }
  return out;
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
