// Reference prices (what an item realistically sells for on YouPin / Buff163).
//
// Provider 1 — CSPriceAPI (needs CSPRICEAPI_KEY): YouPin + Buff163 lowest ask,
//   7d average, listing count and a liquidity score, refreshed ~every 5 min.
//   We POST only the names we just saw (max 100 per call) and cache each name
//   in Redis for REF_TTL_S so repeated scans don't burn quota.
// Provider 2 — csgotrader.app (free fallback, Buff163 only): one big JSON with
//   lowest ask + highest buy order per item. No listing counts, so liquidity
//   is approximated by the buy-order/ask ratio. Prices are USD.

import { fetchJson, normalizePhase, needsPhase, toNumber, toMillis } from './normalize.js';
import { getCnyPerUsd } from './fx.js';

const CSPRICEAPI_URL = 'https://api.cspriceapi.com/v1/prices/latest?markets=youpin,buff163';
const CSGOTRADER_BUFF_URL = 'https://prices.csgotrader.app/latest/buff163.json';
const REF_TTL_S = 5 * 60;
const CSGOTRADER_TTL_MS = 30 * 60 * 1000;
const BATCH = 100;

const refCacheKey = (name) => `skinroi:snipes:ref:${name}`;

export function referenceProvider() {
  return process.env.CSPRICEAPI_KEY ? 'cspriceapi' : 'csgotrader';
}

// items: [{ name, phase }] → Map(itemKey → { youpin, buff163 })
export async function getReferencePrices(redis, items) {
  return referenceProvider() === 'cspriceapi'
    ? fromCsPriceApi(redis, items)
    : fromCsgoTrader(items);
}

// ── CSPriceAPI ─────────────────────────────────────────────────────────────

async function fromCsPriceApi(redis, items) {
  const names = [...new Set(items.map((i) => i.name))];
  const raw = new Map();

  const cached = names.length ? await redis.mget(...names.map(refCacheKey)) : [];
  const missing = [];
  names.forEach((name, i) => {
    if (cached[i]) raw.set(name, cached[i]);
    else missing.push(name);
  });

  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH);
    let data = { items: {} };
    try {
      data = await fetchJson(CSPRICEAPI_URL, {
        method: 'POST',
        headers: { 'x-api-key': process.env.CSPRICEAPI_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: chunk }),
      });
    } catch (e) {
      // 404 = none of the names matched; anything else is a real failure.
      if (e.status !== 404) throw e;
    }
    const pipe = redis.pipeline();
    for (const name of chunk) {
      const entry = data?.items?.[name] || {};
      // A market can come back as one row or one row per Doppler phase.
      const stored = {
        youpin: [].concat(entry.youpin || []),
        buff163: [].concat(entry.buff163 || []),
      };
      raw.set(name, stored);
      pipe.set(refCacheKey(name), stored, { ex: REF_TTL_S });
    }
    if (chunk.length) await pipe.exec();
  }

  const cnyPerUsd = await getCnyPerUsd();
  const out = new Map();
  for (const { name, phase, key } of items) {
    const entry = raw.get(name) || {};
    out.set(key, {
      youpin: pickCsPriceRow(entry.youpin, name, phase, 'price_rmb', cnyPerUsd),
      buff163: pickCsPriceRow(entry.buff163, name, phase, 'price', cnyPerUsd),
    });
  }
  return out;
}

function pickCsPriceRow(rows = [], name, phase, priceField, cnyPerUsd) {
  const wantPhase = needsPhase(name) ? phase : null;
  if (needsPhase(name) && !wantPhase) return null;
  const row = rows.find((r) => (normalizePhase(r.phase) || null) === wantPhase);
  if (!row) return null;
  const ask = toNumber(row[priceField]);
  if (!ask) return null;
  const avg7d = toNumber(row.avg_7d);
  return buildRef({
    askUsd: ask / cnyPerUsd,
    avg7dUsd: avg7d ? avg7d / cnyPerUsd : null,
    count: toNumber(row.count),
    liquidity: toNumber(row.liquidity),
    change7d: toNumber(row.change_7d),
    updatedAt: toMillis(row.updated_at),
  });
}

// ── csgotrader.app (free Buff163 fallback) ─────────────────────────────────

let csgotraderCache = { data: null, at: 0 };

async function loadCsgoTrader() {
  if (csgotraderCache.data && Date.now() - csgotraderCache.at < CSGOTRADER_TTL_MS) {
    return csgotraderCache;
  }
  const data = await fetchJson(CSGOTRADER_BUFF_URL, {}, 20000);
  csgotraderCache = { data, at: Date.now() };
  return csgotraderCache;
}

async function fromCsgoTrader(items) {
  const { data, at } = await loadCsgoTrader();
  const out = new Map();
  for (const { name, phase, key } of items) {
    const entry = data?.[name];
    let ask = entry?.starting_at?.price;
    let bid = entry?.highest_order?.price;
    if (needsPhase(name)) {
      ask = phase ? entry?.starting_at?.doppler?.[phase] : null;
      bid = phase ? entry?.highest_order?.doppler?.[phase] : null;
    }
    ask = toNumber(ask);
    out.set(key, {
      youpin: null,
      buff163: ask ? buildRef({ askUsd: ask, bidUsd: toNumber(bid), updatedAt: at }) : null,
    });
  }
  return out;
}

// ── shared ─────────────────────────────────────────────────────────────────

// priceUsd is the number deals are measured against. When the 7-day average
// is lower than the current ask we use that instead, so a temporary spike in
// the lowest listing doesn't make every listing look like a snipe.
function buildRef({ askUsd, avg7dUsd = null, bidUsd = null, count = null, liquidity = null, change7d = null, updatedAt = null }) {
  const priceUsd = avg7dUsd ? Math.min(askUsd, avg7dUsd) : askUsd;
  return {
    priceUsd: round2(priceUsd),
    askUsd: round2(askUsd),
    avg7dUsd: avg7dUsd ? round2(avg7dUsd) : null,
    bidUsd: bidUsd ? round2(bidUsd) : null,
    count,
    liquidity,
    change7d,
    updatedAt,
  };
}

const round2 = (n) => Math.round(n * 100) / 100;
