// CSFloat's sell price in Snipes is the cheapest CSFloat listing of the same
// item right now, not CSFloat's appraisal. The server can't ask CSFloat (it
// answers 429 to Vercel's many IPs), so the browser extension looks items up:
// every CSFloat push gets back up to LOOKUPS_PER_PUSH names, and the extension
// POSTs the cheapest listings it finds for them. The appraisal in CSFloat's
// feed is only used to decide which items are worth checking first.

import { itemKey, needsPhase } from './normalize.js';
import { normalizeCsfloatListings } from './csfloat.js';

// Matches SNIPE_LOOKUPS_PER_RUN in the extension (it can only do a few per poll).
export const LOOKUPS_PER_PUSH = 3;
const LOWEST_TTL_S = 30 * 60;
const KEEP_LISTINGS = 3;
const WANT_KEY = 'skinroi:snipes:csfwant';
const WANT_MAX = 100;
const WANT_TTL_MS = 30 * 60 * 1000;
const ASK_AGAIN_MS = 10 * 60 * 1000;
// Listings kept per item while it waits, priced again once the lookup is in.
const PENDING_PER_ITEM = 2;

const lowestKey = (key) => `skinroi:snipes:csfl:${key}`;

// Map(itemKey → { listings: [{ id, priceUsd }] cheapest first, sales, steamVolume, at })
export async function loadLowest(redis, keys) {
  const out = new Map();
  if (!keys.length) return out;
  const rows = await redis.mget(...keys.map(lowestKey));
  keys.forEach((k, i) => rows[i] && out.set(k, rows[i]));
  return out;
}

// The cheapest listing other than `excludeId` (a CSFloat listing priced
// against itself would always look like a deal). Null when there is none.
export function csfloatRef(lowest, excludeId = null) {
  const cheapest = lowest?.listings?.find((l) => l.id !== excludeId);
  if (!cheapest) return null;
  return {
    priceUsd: cheapest.priceUsd,
    askUsd: cheapest.priceUsd,
    sales: lowest.sales ?? null,
    steamVolume: lowest.steamVolume ?? null,
    updatedAt: lowest.at,
  };
}

// A listing in CSFloat's newest feed that undercuts a known lowest becomes
// the new lowest, so the price doesn't wait for the next lookup.
export async function mergeFeedListings(redis, lowest, listings) {
  const changed = new Map();
  for (const l of listings) {
    if (l.market !== 'csfloat') continue;
    const key = itemKey(l.name, l.phase);
    const entry = changed.get(key) || lowest.get(key);
    if (!entry || entry.listings.some((x) => x.id === l.listingId)) continue;
    if (entry.listings.length >= KEEP_LISTINGS && l.priceUsd >= entry.listings.at(-1).priceUsd) continue;
    const listings = [...entry.listings, { id: l.listingId, priceUsd: l.priceUsd }]
      .sort((a, b) => a.priceUsd - b.priceUsd)
      .slice(0, KEEP_LISTINGS);
    changed.set(key, {
      ...entry,
      listings,
      sales: entry.sales ?? l.marketInfo?.quantity ?? null,
      steamVolume: entry.steamVolume ?? l.marketInfo?.steamVolume ?? null,
    });
  }
  if (changed.size) {
    const pipe = redis.pipeline();
    for (const [key, entry] of changed) {
      lowest.set(key, entry);
      pipe.set(lowestKey(key), entry, { ex: LOWEST_TTL_S });
    }
    await pipe.exec();
  }
}

// Stores what the extension found: [{ name, rows: raw /api/v1/listings rows
// sorted by lowest price }]. An empty result means nothing is listed on
// CSFloat. Returns the stored names and the listings that were waiting on them.
export async function storeLookups(redis, entries, now) {
  const pipe = redis.pipeline();
  const names = [];
  for (const { name, rows } of Array.isArray(entries) ? entries : []) {
    if (typeof name !== 'string' || needsPhase(name) || !Array.isArray(rows)) continue;
    const listings = normalizeCsfloatListings(rows).filter((l) => l.name === name);
    const first = listings[0];
    pipe.set(lowestKey(itemKey(name, null)), {
      listings: listings
        .map((l) => ({ id: l.listingId, priceUsd: l.priceUsd }))
        .sort((a, b) => a.priceUsd - b.priceUsd)
        .slice(0, KEEP_LISTINGS),
      sales: first?.marketInfo?.quantity ?? null,
      steamVolume: first?.marketInfo?.steamVolume ?? null,
      at: now,
    }, { ex: LOWEST_TTL_S });
    names.push(name);
  }
  if (!names.length) return { names, pending: [] };
  await pipe.exec();
  const want = (await redis.get(WANT_KEY)) || [];
  const done = new Set(names);
  const pending = want.filter((w) => done.has(w.name)).flatMap((w) => w.listings || []);
  await redis.set(WANT_KEY, want.filter((w) => !done.has(w.name)));
  return { names, pending };
}

// candidates: [{ name, priority, listings }] for items without a known
// CSFloat price. Kept in one small list, most promising first, for the
// extension to work through; `listings` are priced again after the lookup.
export async function queueLookups(redis, candidates, now) {
  if (!candidates.length) return;
  const byName = new Map(
    ((await redis.get(WANT_KEY)) || [])
      .filter((w) => now - w.at < WANT_TTL_MS)
      .map((w) => [w.name, w]),
  );
  for (const { name, priority, listings } of candidates) {
    const old = byName.get(name);
    const merged = new Map([...(old?.listings || []), ...listings].map((l) => [l.id, l]));
    byName.set(name, {
      name,
      priority,
      at: now,
      askedAt: old?.askedAt ?? null,
      listings: [...merged.values()].sort((a, b) => a.priceUsd - b.priceUsd).slice(0, PENDING_PER_ITEM),
    });
  }
  const want = [...byName.values()].sort((a, b) => b.priority - a.priority).slice(0, WANT_MAX);
  await redis.set(WANT_KEY, want);
}

// The next names for the extension, skipping ones it was asked about lately.
export async function takeLookups(redis, now) {
  const want = ((await redis.get(WANT_KEY)) || []).filter((w) => now - w.at < WANT_TTL_MS);
  const picked = want
    .filter((w) => !w.askedAt || now - w.askedAt > ASK_AGAIN_MS)
    .slice(0, LOOKUPS_PER_PUSH);
  if (!picked.length) return [];
  for (const w of picked) w.askedAt = now;
  await redis.set(WANT_KEY, want);
  return picked.map((w) => w.name);
}
