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
import {
  csfloatRef, loadLowest, mergeFeedListings, queueLookups, storeLookups, takeLookups,
} from './csfloat-lowest.js';

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

// Markets an item can be sold on. CSFloat's price is the cheapest CSFloat
// listing of the same item (see csfloat-lowest.js).
const SELL_MARKETS = ['youpin', 'buff163', 'csfloat'];
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

// Listings pushed by the extension. The answer also names items whose
// cheapest CSFloat listing the extension should look up next.
export async function ingestListings(source, listings) {
  return withLock(async (redis, now) => {
    const result = await priceAndStore(redis, listings, now, {
      [source]: { ok: true, count: listings.length, lastRun: now, via: 'extension' },
    }, {}, { fromFeed: true });
    return { ...result, csfloatLookups: await takeLookups(redis, now) };
  });
}

// Cheapest CSFloat listings the extension looked up: [{ name, rows }]. The
// listings that were waiting on those items are priced again.
export async function ingestCsfloatLowest(entries) {
  return withLock(async (redis, now) => {
    const { names, pending } = await storeLookups(redis, entries, now);
    const result = await priceAndStore(redis, pending, now, {});
    return { stored: names.length, matched: result.matched };
  });
}

// Pushes wait briefly for a running scan so the two don't race on the deals key.
async function withLock(fn) {
  const redis = getRedis();
  let gotLock = false;
  for (let i = 0; i < 8 && !gotLock; i++) {
    gotLock = await redis.set(LOCK_KEY, Date.now(), { nx: true, ex: 25 });
    if (!gotLock) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!gotLock) throw new Error('scan in progress, try again');
  try {
    return await fn(redis, Date.now());
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

  await priceAndStore(redis, listings, now, sources, { lastScan: now }, { fromFeed: true });
}

// Prices listings, merges the ones under reference into the deal list and
// updates meta. sourcePatch replaces those sources' status; others are kept.
// fromFeed: the listings are fresh from a market feed (not re-priced ones
// waiting on a CSFloat lookup), so CSFloat ones can lower the known cheapest.
async function priceAndStore(redis, listings, now, sourcePatch, metaPatch = {}, { fromFeed = false } = {}) {
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

  const [previous, prevMeta] = await redis.mget(DEALS_KEY, META_KEY);
  const byId = new Map(
    (Array.isArray(previous) ? previous : [])
      .filter((d) => now - d.seenAt < DEAL_TTL_MS)
      .map((d) => [d.id, d]),
  );

  // Cheapest CSFloat listings for the items in this batch, plus the items of
  // kept deals so their CSFloat price stays current.
  const keys = new Set(wanted.map((w) => w.key));
  for (const d of byId.values()) keys.add(itemKey(d.name, d.phase));
  const lowest = await loadLowest(redis, [...keys]);
  if (fromFeed) await mergeFeedListings(redis, lowest, priceable);

  const fresh = [];
  const items = new Map();
  const lookups = new Map();
  for (const l of priceable) {
    const key = itemKey(l.name, l.phase);
    const base = { youpin: null, buff163: null, ...refs.get(key) };
    if (!items.has(key)) {
      items.set(key, { name: l.name, refs: { ...base, csfloat: csfloatRef(lowest.get(key)) }, image: l.image });
    }
    if (!lowest.has(key) && !needsPhase(l.name)) addLookup(lookups, key, l, base);
    const ref = { ...base, csfloat: csfloatRef(lowest.get(key), l.market === 'csfloat' ? l.listingId : null) };
    const best = bestSellPrice(ref);
    if (!best || l.priceUsd > best * (1 - MIN_DISCOUNT)) continue;
    fresh.push({ ...l, refs: ref, seenAt: now });
  }
  const { deals: found, checkedIds } = itemDeals(items, now);
  fresh.push(...found);
  await queueLookups(redis, [...lookups.values()].map(lookupCandidate), now);

  // Kept deals get the current CSFloat price for their item, or none once
  // the last lookup has expired.
  for (const [id, d] of byId) {
    const csfloat = csfloatRef(lowest.get(itemKey(d.name, d.phase)), d.market === 'csfloat' ? d.listingId : null);
    byId.set(id, { ...d, refs: { ...d.refs, csfloat } });
  }
  // An item deal re-checked this round that no longer qualifies is gone.
  for (const id of checkedIds) byId.delete(id);
  // Merge with earlier finds: keep first-seen time, refresh price/ref data.
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

// Collects, per item with no known CSFloat price, its cheapest listings and
// CSFloat's appraisal (from CSFloat's own feed) to rank the lookup.
function addLookup(lookups, key, listing, base) {
  const c = lookups.get(key) || { name: listing.name, appraisal: 0, base, listings: [] };
  if (listing.market === 'csfloat' && listing.csfloatValueUsd) {
    c.appraisal = Math.max(c.appraisal, listing.csfloatValueUsd);
  }
  c.listings.push(listing);
  lookups.set(key, c);
}

// Items most likely to sell well above what they can be bought for go first:
// CSFloat's appraisal over the cheapest buy price, or, without an appraisal,
// a slightly discounted YouPin / Buff163 price instead.
function lookupCandidate({ name, appraisal, base, listings }) {
  const asks = [...listings.map((l) => l.priceUsd), base.youpin?.askUsd, base.buff163?.askUsd].filter((p) => p > 0);
  const cheapest = Math.min(...asks);
  const value = appraisal || 0.9 * bestSellPrice(base);
  return { name, priority: value / cheapest, listings };
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
