// Snipes scanner: takes the newest listings from each marketplace, prices
// them against YouPin / Buff163 / CSFloat and keeps the ones listed below
// what another market pays. It also adds "item deals": an item's lowest ask
// on YouPin or Buff163 when another market pays enough more for it.
//
// Two ways listings come in:
// - Server-fetched sources (DMarket): GET /api/snipes calls ensureFresh(),
//   which rescans when the last scan is older than SCAN_INTERVAL_MS.
// - Pushed sources (CSFloat): the browser extension fetches listings from
//   the user's own IP and POSTs them to POST /api/snipes → ingestListings().
// Both paths share one Redis lock so they never overwrite each other's deals.

import { getRedis } from '../redis.js';
import { fetchDmarketListings } from './dmarket.js';
import { getReferencePrices, referenceProvider } from './reference.js';
import { itemKey, needsPhase } from './normalize.js';

const DEALS_KEY = 'skinroi:snipes:deals';
const META_KEY = 'skinroi:snipes:meta';
const LOCK_KEY = 'skinroi:snipes:lock';

const SCAN_INTERVAL_MS = 45 * 1000;
const DEAL_TTL_MS = 30 * 60 * 1000;
const MAX_DEALS = 500;
// Server keeps anything at least this far under reference; fees, ROI and
// liquidity are filtered in the browser so the user can tune them live.
const MIN_DISCOUNT = 0.02;

// Sources the server fetches itself. After a 429 a source pauses for
// RATE_LIMIT_PAUSE_MS so we don't keep making it worse.
const SOURCES = {
  dmarket: fetchDmarketListings,
};
const RATE_LIMIT_PAUSE_MS = 15 * 60 * 1000;

// Markets an item can be sold on. CSFloat's price is its own appraisal, learned
// from CSFloat listings and kept an hour (the default max reference age).
const SELL_MARKETS = ['youpin', 'buff163', 'csfloat'];
const CSFLOAT_VALUE_TTL_S = 60 * 60;
const csfloatValueKey = (key) => `skinroi:snipes:csf:${key}`;
// Item deals link to a search on the market (same links BetterFloat uses).
const SEARCH_URLS = {
  youpin: (name) => `https://youpin898.com/market/csgo?gameId=730&search=${encodeURIComponent(name)}`,
  buff163: (name) => `https://buff.163.com/market/csgo#tab=selling&page_num=1&search=${encodeURIComponent(name)}`,
};

export function minPriceCents() {
  return parseInt(process.env.SNIPES_MIN_PRICE_CENTS || '200', 10);
}

export async function loadSnipes() {
  const redis = getRedis();
  const [deals, meta] = await redis.mget(DEALS_KEY, META_KEY);
  return { deals: Array.isArray(deals) ? deals : [], meta: meta || null };
}

export async function ensureFresh() {
  const redis = getRedis();
  const meta = await redis.get(META_KEY);
  if (meta?.lastScan && Date.now() - meta.lastScan < SCAN_INTERVAL_MS) return;
  const gotLock = await redis.set(LOCK_KEY, Date.now(), { nx: true, ex: 25 });
  if (!gotLock) return;
  try {
    await scan(redis);
  } finally {
    await redis.del(LOCK_KEY);
  }
}

// Listings pushed by the extension. Waits briefly for a running scan so the
// two don't race on the deals key.
export async function ingestListings(source, listings) {
  const redis = getRedis();
  let gotLock = false;
  for (let i = 0; i < 8 && !gotLock; i++) {
    gotLock = await redis.set(LOCK_KEY, Date.now(), { nx: true, ex: 25 });
    if (!gotLock) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!gotLock) throw new Error('scan in progress, try again');
  try {
    const now = Date.now();
    return await priceAndStore(redis, listings, now, {
      [source]: { ok: true, count: listings.length, lastRun: now, via: 'extension' },
    });
  } finally {
    await redis.del(LOCK_KEY);
  }
}

async function scan(redis) {
  const now = Date.now();
  const prevSources = (await redis.get(META_KEY))?.sources || {};

  const sources = {};
  const due = [];
  for (const name of Object.keys(SOURCES)) {
    const prev = prevSources[name] || {};
    if (prev.pausedUntil && now < prev.pausedUntil) sources[name] = prev;
    else due.push(name);
  }

  const results = await Promise.allSettled(
    due.map((n) => SOURCES[n]({ minPriceCents: minPriceCents() })),
  );
  const listings = [];
  results.forEach((r, i) => {
    const name = due[i];
    if (r.status === 'fulfilled') {
      sources[name] = { ok: true, count: r.value.length, lastRun: now };
      listings.push(...r.value);
    } else {
      const error = r.reason?.message || String(r.reason);
      const pausedUntil = r.reason?.status === 429 ? now + RATE_LIMIT_PAUSE_MS : null;
      sources[name] = { ok: false, error, lastRun: now, pausedUntil };
      console.warn(`[snipes] ${name} failed:`, error);
    }
  });

  await priceAndStore(redis, listings, now, sources, { lastScan: now });
}

// Prices listings, merges the ones under reference into the deal list and
// updates meta. sourcePatch replaces those sources' status; others are kept.
async function priceAndStore(redis, listings, now, sourcePatch, metaPatch = {}) {
  // Dopplers without a known phase can't be priced safely — drop them.
  const priceable = listings.filter((l) => !needsPhase(l.name) || l.phase);
  const wanted = priceable.map((l) => ({ name: l.name, phase: l.phase, key: itemKey(l.name, l.phase) }));

  let refError = null;
  let refs = new Map();
  if (wanted.length) {
    try {
      refs = await getReferencePrices(redis, wanted);
      refError = refs.warning || null;
    } catch (e) {
      refError = e.message;
      console.warn('[snipes] reference prices failed:', e.message);
    }
  }

  const csfloatRefs = await csfloatValues(redis, priceable, now);

  const fresh = [];
  const items = new Map();
  for (const l of priceable) {
    const key = itemKey(l.name, l.phase);
    const ref = { youpin: null, buff163: null, ...refs.get(key), csfloat: csfloatRefs.get(key) || null };
    if (!items.has(key)) items.set(key, { name: l.name, refs: ref, image: l.image });
    const best = bestSellPrice(ref);
    if (!best || l.priceUsd > best * (1 - MIN_DISCOUNT)) continue;
    fresh.push({ ...l, refs: ref, seenAt: now });
  }
  const { deals: found, checkedIds } = itemDeals(items, now);
  fresh.push(...found);

  // Merge with earlier finds: keep first-seen time, refresh price/ref data.
  const [previous, prevMeta] = await redis.mget(DEALS_KEY, META_KEY);
  const byId = new Map(
    (Array.isArray(previous) ? previous : [])
      .filter((d) => now - d.seenAt < DEAL_TTL_MS)
      .map((d) => [d.id, d]),
  );
  // An item deal re-checked this round that no longer qualifies is gone.
  for (const id of checkedIds) byId.delete(id);
  for (const d of fresh) {
    const old = byId.get(d.id);
    byId.set(d.id, old ? { ...d, seenAt: old.seenAt } : d);
  }
  const deals = [...byId.values()].sort((a, b) => b.seenAt - a.seenAt).slice(0, MAX_DEALS);

  const meta = {
    ...(prevMeta || {}),
    ...metaPatch,
    sources: { ...keptSources(prevMeta?.sources), ...sourcePatch },
    refProvider: referenceProvider(),
    refError,
  };
  await redis.mset({ [DEALS_KEY]: deals, [META_KEY]: meta });
  return { checked: listings.length, matched: fresh.length };
}

function bestSellPrice(refs, except) {
  return Math.max(0, ...SELL_MARKETS.filter((m) => m !== except).map((m) => refs[m]?.priceUsd || 0));
}

// CSFloat's appraisal per item, from the CSFloat listings in this batch or
// cached from earlier ones, so DMarket listings and YouPin / Buff163 prices
// can be compared with what the item fetches on CSFloat.
async function csfloatValues(redis, listings, now) {
  const values = new Map();
  for (const l of listings) {
    if (l.market !== 'csfloat' || !l.csfloatValueUsd) continue;
    values.set(itemKey(l.name, l.phase), {
      priceUsd: l.csfloatValueUsd,
      sales: l.marketInfo?.quantity ?? null,
      steamVolume: l.marketInfo?.steamVolume ?? null,
      updatedAt: now,
    });
  }
  if (values.size) {
    const pipe = redis.pipeline();
    for (const [key, v] of values) pipe.set(csfloatValueKey(key), v, { ex: CSFLOAT_VALUE_TTL_S });
    await pipe.exec();
  }
  const missing = [...new Set(listings.map((l) => itemKey(l.name, l.phase)))].filter((k) => !values.has(k));
  const cached = missing.length ? await redis.mget(...missing.map(csfloatValueKey)) : [];
  missing.forEach((k, i) => cached[i] && values.set(k, cached[i]));
  return values;
}

// YouPin and Buff163 have no listing feed here, so buying there means paying
// the item's lowest ask. One deal per item and market when another market
// pays enough more. Dopplers are skipped: SteamDT doesn't split phases.
function itemDeals(items, now) {
  const deals = [];
  const checkedIds = [];
  for (const { name, refs, image } of items.values()) {
    if (needsPhase(name)) continue;
    for (const market of ['youpin', 'buff163']) {
      const ask = refs[market]?.askUsd;
      if (!ask) continue;
      const id = `${market}:${name}`;
      checkedIds.push(id);
      if (ask > bestSellPrice(refs, market) * (1 - MIN_DISCOUNT)) continue;
      deals.push({
        id,
        market,
        listingId: null,
        name,
        phase: null,
        priceUsd: ask,
        float: null,
        paintSeed: null,
        stickers: [],
        stickerValueUsd: 0,
        tradeLocked: false,
        image,
        url: SEARCH_URLS[market](name),
        listedAt: null,
        marketInfo: {},
        itemLevel: true,
        refs,
        seenAt: now,
      });
    }
  }
  return { deals, checkedIds };
}

// Drop stale status for sources the server no longer fetches itself (e.g. an
// old CSFloat rate-limit entry from before the extension took over).
function keptSources(sources = {}) {
  return Object.fromEntries(
    Object.entries(sources).filter(([name, v]) => name in SOURCES || v?.via === 'extension'),
  );
}
