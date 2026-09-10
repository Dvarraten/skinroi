// CSFloat inspect enrichment.
//
// Steam's trade offer / inventory endpoints don't ship float, paint seed,
// or sticker info — that data is only accessible via the in-game item
// inspector. CSFloat's public API takes a Steam inspect_link and returns
// the parsed struct. Same API their own extension uses.
//
// For each new trade item, we:
//   1. Build the inspect_link from the description's `actions[].link` template
//      (substitutes %owner_steamid% and %assetid%)
//   2. Look up the assetid in our persistent cache — a specific asset's
//      inspect data never changes, so cached entries are permanent hits
//   3. On cache miss, call CSFloat with a small delay between requests
//   4. Attach { floatValue, paintSeed, paintIndex, defIndex, stickers,
//      keychains } to the item; save to cache

import { CSFLOAT_INSPECT_API, INSPECT_MIN_DELAY_MS } from './config.js';

// Extract the inspect_link template from a description's actions and
// materialise it for a specific owner + asset. Returns null if the item
// isn't inspectable (agent items, capsules, keys — anything without an
// inspect action).
export function buildInspectLink(desc, ownerSteamId, assetid) {
  if (!desc || !ownerSteamId || !assetid) return null;
  const actions = [
    ...(Array.isArray(desc.actions) ? desc.actions : []),
    ...(Array.isArray(desc.market_actions) ? desc.market_actions : []),
  ];
  for (const a of actions) {
    const link = a?.link;
    if (typeof link !== 'string') continue;
    if (!link.includes('+csgo_econ_action_preview')) continue;
    return link
      .replace('%owner_steamid%', String(ownerSteamId))
      .replace('%assetid%', String(assetid));
  }
  return null;
}

// Call CSFloat's inspect endpoint. Returns the parsed metadata subset we
// care about, or null on failure.
export async function fetchInspectMetadata(inspectLink) {
  if (!inspectLink) return null;
  const url = `${CSFLOAT_INSPECT_API}?url=${encodeURIComponent(inspectLink)}`;
  let res;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let json;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const info = json?.iteminfo || json;
  if (!info || typeof info !== 'object') return null;

  return {
    floatValue:
      typeof info.floatvalue === 'number' && Number.isFinite(info.floatvalue)
        ? info.floatvalue
        : null,
    paintSeed:
      typeof info.paintseed === 'number' && Number.isFinite(info.paintseed)
        ? info.paintseed
        : null,
    paintIndex:
      typeof info.paintindex === 'number' && Number.isFinite(info.paintindex)
        ? info.paintindex
        : null,
    defIndex:
      typeof info.defindex === 'number' && Number.isFinite(info.defindex)
        ? info.defindex
        : null,
    stickers: normalizeStickers(info.stickers),
    keychains: normalizeKeychains(info.keychains),
    // Full name from CSFloat — useful as a fallback when Steam's inventory
    // endpoint hasn't propagated the item's description yet (common right
    // after a trade completes, especially for unique-classid items like
    // Souvenir skins with tournament stickers baked in).
    fullItemName:
      typeof info.full_item_name === 'string' && info.full_item_name.trim()
        ? info.full_item_name.trim()
        : null,
  };
}

function normalizeStickers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const sticker_id = Number(s.sticker_id);
      if (!Number.isFinite(sticker_id)) return null;
      return {
        slot: Number.isFinite(Number(s.slot)) ? Number(s.slot) : null,
        stickerId: sticker_id,
        name: typeof s.name === 'string' ? s.name : null,
        wear:
          typeof s.wear === 'number' && Number.isFinite(s.wear) ? s.wear : null,
      };
    })
    .filter(Boolean);
}

function normalizeKeychains(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((k) => {
      if (!k || typeof k !== 'object') return null;
      const sticker_id = Number(k.sticker_id);
      if (!Number.isFinite(sticker_id)) return null;
      return {
        slot: Number.isFinite(Number(k.slot)) ? Number(k.slot) : null,
        stickerId: sticker_id,
        pattern: Number.isFinite(Number(k.pattern)) ? Number(k.pattern) : null,
      };
    })
    .filter(Boolean);
}

// Enrich a list of normalized offers (from normalizeAcceptedOffers) with
// inspect metadata for each item. Uses (and updates) a persistent cache
// map keyed by assetid — pass the map in and it's mutated in place.
//
// Rate limits: CSFloat's public API is used by their own extension for
// bulk market scans; a personal trader hitting it a few times a day is
// well within polite usage. We still throttle to INSPECT_MIN_DELAY_MS
// between calls and skip enrichment for items already in cache.
export async function enrichOffersWithInspect({
  offers,
  descByKey,
  ownerSteamId,
  cache,
}) {
  if (!Array.isArray(offers) || offers.length === 0) return;
  if (!ownerSteamId) return;

  let lastCallAt = 0;
  for (const offer of offers) {
    for (const item of offer.items) {
      // Cache hit — attach and skip network call.
      const cached = cache[item.assetid];
      if (cached) {
        attachInspect(item, cached);
        continue;
      }

      // Only enrich if we can find the description (needed for the inspect
      // action template). "Unknown CS2 Item" fallbacks won't have one.
      const desc = descByKey.get(`${item.classid || ''}_${item.instanceid || '0'}`);
      const inspectLink = buildInspectLink(desc, ownerSteamId, item.assetid);
      if (!inspectLink) continue;

      const wait = INSPECT_MIN_DELAY_MS - (Date.now() - lastCallAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCallAt = Date.now();

      const meta = await fetchInspectMetadata(inspectLink);
      if (!meta) continue;

      cache[item.assetid] = meta;
      attachInspect(item, meta);
    }
  }
}

function attachInspect(item, meta) {
  if (meta.floatValue != null) item.floatValue = meta.floatValue;
  if (meta.paintSeed != null) item.paintSeed = meta.paintSeed;
  if (meta.paintIndex != null) item.paintIndex = meta.paintIndex;
  if (meta.defIndex != null) item.defIndex = meta.defIndex;
  if (Array.isArray(meta.stickers) && meta.stickers.length > 0) {
    item.stickers = meta.stickers;
  }
  if (Array.isArray(meta.keychains) && meta.keychains.length > 0) {
    item.keychains = meta.keychains;
  }
  // Rename "Unknown CS2 Item (classid)" fallback if CSFloat gave us a real name.
  if (
    meta.fullItemName &&
    typeof item.marketHashName === 'string' &&
    item.marketHashName.startsWith('Unknown CS2 Item')
  ) {
    item.marketHashName = meta.fullItemName;
  }
}
