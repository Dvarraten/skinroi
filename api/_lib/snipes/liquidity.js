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

import { liquidityScore } from '../../../src/shared/liquidity.js';

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

// The 0–100 score is shared with the Snipes page (src/shared/liquidity.js).
export { liquidityScore };

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
