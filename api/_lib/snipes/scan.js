// Snipes scanner: pulls the newest listings from each marketplace, prices
// them against YouPin / Buff163 and keeps the ones listed below reference.
//
// There is no background worker: GET /api/snipes calls ensureFresh(), which
// rescans when the last scan is older than SCAN_INTERVAL_MS. A Redis lock
// makes sure concurrent viewers trigger only one scan.

import { getRedis } from '../redis.js';
import { fetchCsfloatListings } from './csfloat.js';
import { fetchDmarketListings } from './dmarket.js';
import { getReferencePrices, referenceProvider } from './reference.js';
import { itemKey, needsPhase } from './normalize.js';

const DEALS_KEY = 'skinroi:snipes:deals';
const META_KEY = 'skinroi:snipes:meta';
const LOCK_KEY = 'skinroi:snipes:lock';

const SCAN_INTERVAL_MS = 45 * 1000;
const DEAL_TTL_MS = 30 * 60 * 1000;
const MAX_DEALS = 400;
// Server keeps anything at least this far under reference; fees, ROI and
// liquidity are filtered in the browser so the user can tune them live.
const MIN_DISCOUNT = 0.02;

// minIntervalMs keeps us under each market's rate limit; after a 429 the
// source pauses for RATE_LIMIT_PAUSE_MS so we don't keep making it worse.
const SOURCES = {
  csfloat: { fetch: fetchCsfloatListings, minIntervalMs: 2 * 60 * 1000 },
  dmarket: { fetch: fetchDmarketListings, minIntervalMs: 0 },
};
const RATE_LIMIT_PAUSE_MS = 15 * 60 * 1000;

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

async function scan(redis) {
  const minPriceCents = parseInt(process.env.SNIPES_MIN_PRICE_CENTS || '200', 10);
  const now = Date.now();
  const prevMeta = (await redis.get(META_KEY)) || {};
  const prevSources = prevMeta.sources || {};

  const sources = {};
  const due = [];
  for (const [name, src] of Object.entries(SOURCES)) {
    const prev = prevSources[name] || {};
    if (prev.pausedUntil && now < prev.pausedUntil) {
      sources[name] = prev;
    } else if (prev.lastRun && now - prev.lastRun < src.minIntervalMs) {
      sources[name] = { ...prev, skipped: true };
    } else {
      due.push(name);
    }
  }

  const results = await Promise.allSettled(due.map((n) => SOURCES[n].fetch({ minPriceCents })));
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

  // Dopplers without a known phase can't be priced safely — drop them.
  const priceable = listings.filter((l) => !needsPhase(l.name) || l.phase);
  const wanted = priceable.map((l) => ({ name: l.name, phase: l.phase, key: itemKey(l.name, l.phase) }));

  let refError = null;
  let refs = new Map();
  try {
    refs = await getReferencePrices(redis, wanted);
  } catch (e) {
    refError = e.message;
    console.warn('[snipes] reference prices failed:', e.message);
  }

  const fresh = [];
  for (const l of priceable) {
    const ref = refs.get(itemKey(l.name, l.phase));
    if (!ref || (!ref.youpin && !ref.buff163)) continue;
    const best = Math.max(ref.youpin?.priceUsd || 0, ref.buff163?.priceUsd || 0);
    if (l.priceUsd > best * (1 - MIN_DISCOUNT)) continue;
    fresh.push({ ...l, refs: ref, seenAt: now });
  }

  // Merge with earlier finds: keep first-seen time, refresh price/ref data.
  const previous = (await redis.get(DEALS_KEY)) || [];
  const byId = new Map(previous.filter((d) => now - d.seenAt < DEAL_TTL_MS).map((d) => [d.id, d]));
  for (const d of fresh) {
    const old = byId.get(d.id);
    byId.set(d.id, old ? { ...d, seenAt: old.seenAt } : d);
  }
  const deals = [...byId.values()].sort((a, b) => b.seenAt - a.seenAt).slice(0, MAX_DEALS);

  const meta = {
    lastScan: now,
    sources,
    refProvider: referenceProvider(),
    refError,
    scanned: listings.length,
    matched: fresh.length,
  };
  await redis.mset({ [DEALS_KEY]: deals, [META_KEY]: meta });
}
