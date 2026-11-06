// Public CS2 inventory of the signed-in user, for the one-click import on
// Add item (GET /api/inventory/state?steamInventory=1).
//
// Uses Steam's public inventory endpoint, the same one anyone can open in a
// browser, so it only works when the user's inventory is public. No Buff,
// YouPin or other marketplace is involved. Steam rate-limits this endpoint
// hard, so the result is cached per user for 10 minutes and at most three
// pages (6000 items) are read per import.

import { getRedis } from './redis.js';

const CACHE_TTL_S = 10 * 60;
const PAGE_SIZE = 2000;
const MAX_PAGES = 3;
const CS2_APP_ID = 730;
const STEAM_IMG = 'https://community.akamai.steamstatic.com/economy/image/';

const cacheKey = (steamId) => `skinroi:steaminv:${steamId}`;

export class SteamInventoryError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Steam's newer responses carry float and paint seed per asset in
// asset_properties (propertyid 2 = wear float, 1 = pattern template).
function propertiesByAsset(list) {
  const map = new Map();
  for (const entry of Array.isArray(list) ? list : []) {
    const props = {};
    for (const p of entry?.asset_properties || []) {
      if (p.propertyid === 2 && p.float_value != null) props.floatValue = Number(p.float_value);
      if (p.propertyid === 1 && p.int_value != null) props.paintSeed = Number(p.int_value);
    }
    if (entry?.assetid) map.set(String(entry.assetid), props);
  }
  return map;
}

// Turns one or more raw inventory pages into slim, importable rows. Only
// marketable items are kept: medals, graffiti in use, service coins and the
// like can't be priced or sold, so they don't belong in a portfolio.
export function normalizeInventory(pages) {
  const descs = new Map();
  const props = new Map();
  for (const page of pages) {
    for (const d of page?.descriptions || []) descs.set(`${d.classid}_${d.instanceid}`, d);
    for (const [k, v] of propertiesByAsset(page?.asset_properties)) props.set(k, v);
  }
  const out = [];
  for (const page of pages) {
    for (const a of page?.assets || []) {
      const d = descs.get(`${a.classid}_${a.instanceid}`);
      if (!d || !d.marketable || !d.market_hash_name) continue;
      const p = props.get(String(a.assetid)) || {};
      const row = {
        assetid: String(a.assetid),
        name: d.market_hash_name,
        iconUrl: d.icon_url ? `${STEAM_IMG}${d.icon_url}` : null,
        tradable: !!d.tradable,
        type: d.type || '',
      };
      if (Number.isFinite(p.floatValue)) row.floatValue = p.floatValue;
      if (Number.isFinite(p.paintSeed)) row.paintSeed = p.paintSeed;
      out.push(row);
    }
  }
  return out;
}

async function fetchPage(steamId, startAssetId) {
  const url = new URL(`https://steamcommunity.com/inventory/${steamId}/${CS2_APP_ID}/2`);
  url.searchParams.set('l', 'english');
  url.searchParams.set('count', String(PAGE_SIZE));
  if (startAssetId) url.searchParams.set('start_assetid', startAssetId);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkinROI)', Accept: 'application/json' },
  });
  if (res.status === 403 || res.status === 401) {
    throw new SteamInventoryError(
      'Your Steam inventory is private. Set it to public in Steam (Edit profile → Privacy settings → Inventory) and try again.',
      403, 'private',
    );
  }
  if (res.status === 429) {
    throw new SteamInventoryError('Steam is rate limiting inventory requests. Try again in a few minutes.', 429, 'rate_limited');
  }
  if (!res.ok) throw new SteamInventoryError(`Steam answered HTTP ${res.status}. Try again later.`, 502, 'steam_error');
  const data = await res.json().catch(() => null);
  // Steam answers null or success:false for private inventories too.
  if (!data || data.success === false || data.success === 0) {
    throw new SteamInventoryError(
      'Steam did not return your inventory. Make sure it is public and try again.',
      403, 'private',
    );
  }
  return data;
}

export async function loadSteamInventory(steamId, { fresh = false } = {}) {
  const redis = getRedis();
  if (!fresh) {
    const cached = await redis.get(cacheKey(steamId));
    if (cached && Array.isArray(cached.items)) return { ...cached, cached: true };
  }

  const pages = [];
  let start = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await fetchPage(steamId, start);
    pages.push(page);
    if (!page.more_items || !page.last_assetid) break;
    start = page.last_assetid;
  }

  const result = {
    items: normalizeInventory(pages),
    total: pages[0]?.total_inventory_count ?? null,
    fetchedAt: Date.now(),
  };
  await redis.set(cacheKey(steamId), result, { ex: CACHE_TTL_S });
  return result;
}
