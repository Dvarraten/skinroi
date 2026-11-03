// Reference prices (what an item realistically sells for on YouPin / Buff163).
//
// Provider 1 — CSPriceAPI (needs CSPRICEAPI_KEY): YouPin + Buff163 lowest ask,
//   7d average, listing count and a liquidity score, refreshed ~every 5 min.
//   We POST only the names we just saw (max 100 per call) and cache each name
//   in Redis for REF_TTL_S so repeated scans don't burn quota.
// Provider 2 — SteamDT open platform (needs STEAMDT_API_KEY, free for any
//   SteamDT user): YouPin + Buff163 lowest ask, buy order and listing count.
//   The batch endpoint takes 100 names and allows one call a minute, so each
//   name is cached in Redis for STEAMDT_TTL_S and names it can't cover yet
//   (and Dopplers, which SteamDT doesn't split by phase) use csgotrader.
//   Prices are CNY.
// Provider 3 — csgotrader.app (free fallback, Buff163 only): one big JSON with
//   lowest ask + highest buy order per item. No listing counts, so liquidity
//   is approximated by the buy-order/ask ratio. Prices are USD.

import { fetchJson, normalizePhase, needsPhase, toNumber, toMillis } from './normalize.js';
import { getCnyPerUsd } from './fx.js';

const CSPRICEAPI_URL = 'https://api.cspriceapi.com/v1/prices/latest?markets=youpin,buff163';
const CSGOTRADER_BUFF_URL = 'https://prices.csgotrader.app/latest/buff163.json';
const STEAMDT_BATCH_URL = 'https://open.steamdt.com/open/cs2/v1/price/batch';
const STEAMDT_TTL_S = 30 * 60;
const STEAMDT_GATE_KEY = 'skinroi:snipes:steamdt:gate';
const STEAMDT_PLATFORMS = { YOUPIN: 'youpin', BUFF: 'buff163' };
const REF_TTL_S = 5 * 60;
const CSGOTRADER_TTL_MS = 30 * 60 * 1000;
const BATCH = 100;

const refCacheKey = (name) => `skinroi:snipes:ref:${name}`;
const steamDtCacheKey = (name) => `skinroi:snipes:sdt:${name}`;

export function referenceProvider() {
  if (process.env.CSPRICEAPI_KEY) return 'cspriceapi';
  if (process.env.STEAMDT_API_KEY) return 'steamdt';
  return 'csgotrader';
}

// items: [{ name, phase }] → Map(itemKey → { youpin, buff163 }). A provider
// that partly failed but still has prices sets `warning` on the map.
export async function getReferencePrices(redis, items) {
  const provider = referenceProvider();
  if (provider === 'cspriceapi') return fromCsPriceApi(redis, items);
  if (provider === 'steamdt') return fromSteamDt(redis, items);
  return fromCsgoTrader(items);
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

// ── SteamDT ────────────────────────────────────────────────────────────────

async function fromSteamDt(redis, items) {
  const names = [...new Set(items.filter((i) => !needsPhase(i.name)).map((i) => i.name))];
  let { raw, warning } = await loadSteamDtRows(redis, names);

  // Buff163 from csgotrader for anything SteamDT hasn't covered.
  let fallback = new Map();
  if (items.some((i) => !raw.get(i.name)?.buff163)) {
    try {
      fallback = await fromCsgoTrader(items);
    } catch (e) {
      warning = warning || `csgotrader: ${e.message}`;
    }
  }

  const cnyPerUsd = await getCnyPerUsd();
  const out = new Map();
  for (const { name, key } of items) {
    const entry = needsPhase(name) ? null : raw.get(name);
    out.set(key, {
      youpin: steamDtRef(entry?.youpin, entry?.at, cnyPerUsd),
      buff163: steamDtRef(entry?.buff163, entry?.at, cnyPerUsd) || fallback.get(key)?.buff163 || null,
    });
  }
  if (warning) out.warning = warning;
  return out;
}

// Raw SteamDT rows for names: Map(name → { youpin, buff163, at }) with CNY
// prices, from the 30 min Redis cache, plus one batch call for missing names
// when the shared one-call-a-minute gate is free. Also used by Home's sell
// prices (_lib/sell-prices.js). Returns { raw, warning }.
export async function loadSteamDtRows(redis, names) {
  const raw = new Map();
  if (!process.env.STEAMDT_API_KEY) return { raw, warning: 'STEAMDT_API_KEY is not set' };
  const cached = names.length ? await redis.mget(...names.map(steamDtCacheKey)) : [];
  const missing = [];
  names.forEach((name, i) => {
    if (cached[i]) raw.set(name, cached[i]);
    else missing.push(name);
  });

  let warning = null;
  // One batch call a minute across all scans and extension pushes. A failure
  // is kept on the gate key so scans in between keep showing it.
  const gotGate = missing.length && (await redis.set(STEAMDT_GATE_KEY, { at: Date.now() }, { nx: true, ex: 60 }));
  if (missing.length && !gotGate) warning = (await redis.get(STEAMDT_GATE_KEY))?.error || null;
  if (gotGate) {
    try {
      const fetched = await fetchSteamDtBatch(missing.slice(0, BATCH));
      const pipe = redis.pipeline();
      for (const [name, entry] of fetched) {
        raw.set(name, entry);
        pipe.set(steamDtCacheKey(name), entry, { ex: STEAMDT_TTL_S });
      }
      if (fetched.size) await pipe.exec();
    } catch (e) {
      warning = `SteamDT: ${e.message}`;
      console.warn('[snipes] SteamDT failed:', e.message);
      await redis.set(STEAMDT_GATE_KEY, { at: Date.now(), error: warning }, { ex: 60 });
    }
  }
  return { raw, warning };
}

// → Map(name → { youpin, buff163, at }) with raw CNY rows. Names SteamDT
// doesn't know get empty entries so they aren't asked for again right away.
async function fetchSteamDtBatch(names) {
  const json = await fetchJson(STEAMDT_BATCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STEAMDT_API_KEY.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ marketHashNames: names }),
  }, 20000);
  if (json?.success === false || !Array.isArray(json?.data)) {
    const reason = String(json?.errorMsg || json?.errorCodeStr || json?.errorCode || '');
    if (reason.includes('凭证')) throw new Error(`key rejected, check STEAMDT_API_KEY (${reason})`);
    if (reason.includes('配额')) throw new Error(`quota used up, waiting for the next window (${reason})`);
    throw new Error(reason || `unexpected answer, keys: ${Object.keys(json || {}).join(',')}`);
  }

  const at = Date.now();
  const out = new Map(names.map((n) => [n, { youpin: null, buff163: null, at }]));
  for (const item of json.data) {
    const entry = out.get(item?.marketHashName);
    if (!entry) continue;
    for (const p of item.dataList || []) {
      const market = STEAMDT_PLATFORMS[String(p?.platform || '').toUpperCase()];
      const sell = toNumber(p?.sellPrice);
      if (!market || !sell) continue;
      entry[market] = {
        sell,
        sellCount: toNumber(p.sellCount),
        bid: toNumber(p.biddingPrice),
        bidCount: toNumber(p.biddingCount),
      };
    }
  }
  return out;
}

function steamDtRef(row, at, cnyPerUsd) {
  if (!row) return null;
  return {
    ...buildRef({
      askUsd: row.sell / cnyPerUsd,
      bidUsd: row.bid ? row.bid / cnyPerUsd : null,
      count: row.sellCount,
      updatedAt: at,
    }),
    bidCount: row.bidCount ?? null,
  };
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
