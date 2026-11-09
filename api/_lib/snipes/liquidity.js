// Liquidity prefilter for Snipes: items that rarely sell are dropped before
// they are priced, so they never cost a SteamDT batch slot or a CSFloat
// lookup from the extension. A cheap listing of an item nobody buys is not a
// deal anyway.
//
// Two checks:
// - By name (free, works for every source): Souvenir, Well-Worn and
//   Battle-Scarred skins, and stickers, graffiti, patches, music kits and
//   charms. Tune with SNIPES_SKIP_WEARS (comma list, e.g. "Battle-Scarred"
//   to keep Well-Worn) and SNIPES_KEEP_SOUVENIRS=1.
// - By volume, when the listing says it (CSFloat's feed carries the item's
//   Steam Community Market daily volume): fewer than SNIPES_MIN_STEAM_VOLUME
//   sales a day (default 3) is too slow.
// Once SteamDT has answered, items with only a few YouPin / Buff163 listings
// are not looked up on CSFloat either (isThinMarket).

const DEFAULT_SKIP_WEARS = ['Well-Worn', 'Battle-Scarred'];
const NON_SKIN = /^(Sticker|Sealed Graffiti|Graffiti|Patch|Music Kit|StatTrak™ Music Kit|Charm) \|/;
// A market with fewer listings than this counts as thin on SteamDT.
const MIN_SELL_COUNT = 20;

function skipWears() {
  const raw = process.env.SNIPES_SKIP_WEARS;
  if (raw == null) return DEFAULT_SKIP_WEARS;
  return raw.split(',').map((w) => w.trim()).filter(Boolean);
}

function minSteamVolume() {
  const n = parseInt(process.env.SNIPES_MIN_STEAM_VOLUME || '3', 10);
  return Number.isFinite(n) ? n : 3;
}

// Why a name is skipped ('souvenir', 'wear', 'non-skin'), or null if it is kept.
export function illiquidNameReason(name) {
  if (typeof name !== 'string' || !name) return 'non-skin';
  if (NON_SKIN.test(name)) return 'non-skin';
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
