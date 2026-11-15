// Liquidity prefilter for Snipes: items that rarely sell are dropped before
// they are priced, so they never cost a SteamDT batch slot or a CSFloat
// lookup from the extension. A cheap listing of an item nobody buys is not a
// deal anyway.
//
// Before pricing (free, cuts SteamDT batch slots and CSFloat lookups):
// - By name, for every source: Souvenir, Well-Worn and Battle-Scarred skins;
//   stickers, graffiti, patches, music kits and charms; and cases, capsules,
//   souvenir packages, keys, passes and pins (every name without " | " that
//   isn't a ★ knife or glove). Tune with SNIPES_SKIP_WEARS (comma list, e.g.
//   "Battle-Scarred" to keep Well-Worn) and SNIPES_KEEP_SOUVENIRS=1.
// - By volume, when the listing says it (CSFloat's feed carries the item's
//   Steam Community Market daily volume): fewer than SNIPES_MIN_STEAM_VOLUME
//   sales a day (default 10) is too slow.
// After pricing, a deal is only kept when its liquidity score (0-100, the
// same formula the Snipes page shows) reaches SNIPES_MIN_LIQUIDITY (default
// 75) on at least one market it can be sold on. Items with no liquidity data
// at all are dropped too. Items below the bar are never looked up on CSFloat.

const DEFAULT_SKIP_WEARS = ['Well-Worn', 'Battle-Scarred'];
const NON_SKIN = /^(Sticker|Sealed Graffiti|Graffiti|Patch|Music Kit|StatTrak™ Music Kit|Charm) \|/;
// A market with fewer listings than this counts as thin on SteamDT.
const MIN_SELL_COUNT = 20;
const DEFAULT_MIN_STEAM_VOLUME = 10;
const DEFAULT_MIN_LIQUIDITY = 75;

function skipWears() {
  const raw = process.env.SNIPES_SKIP_WEARS;
  if (raw == null) return DEFAULT_SKIP_WEARS;
  return raw.split(',').map((w) => w.trim()).filter(Boolean);
}

function intEnv(name, fallback) {
  const n = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

const minSteamVolume = () => intEnv('SNIPES_MIN_STEAM_VOLUME', DEFAULT_MIN_STEAM_VOLUME);
export const minLiquidity = () => intEnv('SNIPES_MIN_LIQUIDITY', DEFAULT_MIN_LIQUIDITY);

// Why a name is skipped ('souvenir', 'wear', 'non-skin'), or null if it is kept.
export function illiquidNameReason(name) {
  if (typeof name !== 'string' || !name) return 'non-skin';
  if (NON_SKIN.test(name)) return 'non-skin';
  // Cases, capsules, souvenir packages, keys, passes, pins: no " | " in the
  // name. Vanilla knives / gloves ("★ Karambit") have none either but sell.
  if (!name.includes(' | ') && !name.startsWith('★')) return 'container';
  if (/^Souvenir /.test(name) && process.env.SNIPES_KEEP_SOUVENIRS !== '1') return 'souvenir';
  const wear = name.match(/\(([^()]+)\)\s*$/)?.[1];
  if (wear && skipWears().includes(wear)) return 'wear';
  return null;
}

// Why a listing is skipped, or null if it is liquid enough to price.
export function illiquidReason(listing) {
  const byName = illiquidNameReason(listing?.name);
  if (byName) return byName;
  const volume = listing?.marketInfo?.steamVolume;
  if (typeof volume === 'number' && volume < minSteamVolume()) return 'volume';
  return null;
}

// Splits listings into the liquid ones and a count per skip reason.
export function filterLiquid(listings) {
  const kept = [];
  const skipped = {};
  for (const l of listings) {
    const reason = illiquidReason(l);
    if (reason) skipped[reason] = (skipped[reason] || 0) + 1;
    else kept.push(l);
  }
  return { kept, skipped };
}

// True when YouPin / Buff163 listing counts are known and all of them are
// small: the item barely trades there, so it isn't worth a CSFloat lookup.
// refs: { youpin, buff163 } as built by reference.js (count = listings).
export function isThinMarket(refs) {
  const counts = [refs?.youpin?.count, refs?.buff163?.count].filter((c) => typeof c === 'number');
  return counts.length > 0 && Math.max(...counts) < MIN_SELL_COUNT;
}

// 0..1 helpers: log scale reaches 1 at `full`, linear maps lo..hi to 0..1.
const logScale = (v, full) => (v == null ? null : Math.min(1, Math.log10(1 + Math.max(0, v)) / Math.log10(1 + full)));
const linear = (v, lo, hi) => (v == null ? null : Math.max(0, Math.min(1, (v - lo) / (hi - lo))));

// How easily the item sells on `market`, 0-100. Mirrors liquidityScore in
// src/utils/snipes.js (the page can't import from api/), so keep them equal.
// YouPin / Buff163: buy orders 40 %, best buy order / lowest ask 40 %,
// listings 20 %. CSFloat: recorded sales 60 %, Steam daily volume 40 %.
// Missing parts are left out and the rest re-weighted; null if none known.
export function liquidityScore(market, ref) {
  if (!ref) return null;
  const bidAsk = ref.bidUsd && ref.askUsd ? ref.bidUsd / ref.askUsd : null;
  const parts = market === 'csfloat'
    ? [[logScale(ref.sales, 50), 0.6], [logScale(ref.steamVolume, 50), 0.4]]
    : [[logScale(ref.bidCount, 100), 0.4], [linear(bidAsk, 0.75, 0.97), 0.4], [logScale(ref.count, 200), 0.2]];
  const known = parts.filter(([v]) => v != null);
  if (!known.length) return null;
  const weight = known.reduce((sum, [, w]) => sum + w, 0);
  return Math.round((100 * known.reduce((sum, [v, w]) => sum + v * w, 0)) / weight);
}

// Best score over the markets the item can be sold on, or null if none is known.
export function bestLiquidity(refs) {
  const scores = ['youpin', 'buff163', 'csfloat']
    .map((m) => liquidityScore(m, refs?.[m]))
    .filter((s) => s != null);
  return scores.length ? Math.max(...scores) : null;
}

// True when at least one sell market reaches SNIPES_MIN_LIQUIDITY.
export function isLiquidEnough(refs) {
  const score = bestLiquidity(refs);
  return score != null && score >= minLiquidity();
}
