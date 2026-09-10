// Thin promise-based wrapper around chrome.storage.local. All state the
// extension persists (pairing secret, baseline flag, activity log) flows
// through here.

import { STORAGE_KEYS, DEFAULT_BASE_URL } from './config.js';

export function get(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

export function set(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

export function remove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

export async function getPairing() {
  const data = await get([
    STORAGE_KEYS.BASE_URL,
    STORAGE_KEYS.SECRET,
    STORAGE_KEYS.STEAM_ID,
    STORAGE_KEYS.PAIRED_AT,
  ]);
  return {
    baseUrl: data[STORAGE_KEYS.BASE_URL] || DEFAULT_BASE_URL,
    secret: data[STORAGE_KEYS.SECRET] || null,
    steamId: data[STORAGE_KEYS.STEAM_ID] || null,
    pairedAt: data[STORAGE_KEYS.PAIRED_AT] || null,
  };
}

export async function savePairing({ secret, steamId }) {
  await set({
    [STORAGE_KEYS.SECRET]: secret,
    [STORAGE_KEYS.STEAM_ID]: steamId,
    [STORAGE_KEYS.PAIRED_AT]: Date.now(),
  });
}

// Wipe pairing + baseline flag on unpair so a re-pair starts fresh.
export async function clearPairing() {
  await remove([
    STORAGE_KEYS.SECRET,
    STORAGE_KEYS.STEAM_ID,
    STORAGE_KEYS.PAIRED_AT,
    STORAGE_KEYS.HAS_SEEDED_OFFERS,
  ]);
}

export async function setBaseUrl(url) {
  await set({ [STORAGE_KEYS.BASE_URL]: url });
}

// Baseline flag — after first successful sync, the extension has told the
// backend about every historical trade offer id (seeded processedTradeIds).
// Subsequent syncs only surface offers whose id isn't already seeded.
export async function getHasSeededOffers() {
  const data = await get([STORAGE_KEYS.HAS_SEEDED_OFFERS]);
  return Boolean(data[STORAGE_KEYS.HAS_SEEDED_OFFERS]);
}

export async function setHasSeededOffers(val) {
  await set({ [STORAGE_KEYS.HAS_SEEDED_OFFERS]: !!val });
}

// Persistent description cache: classid_instanceid → { market_hash_name, icon_url }.
// Steam's trade-offer API is stingy with descriptions, and outgoing trade
// items disappear from inventory before we can look them up. Caching every
// desc we ever see (from offers and inventory) means once we've held an
// item type once, we can name it in outgoing trades forever.
const DESC_CACHE_MAX = 5000;

export async function getDescCache() {
  const data = await get([STORAGE_KEYS.DESC_CACHE]);
  const raw = data[STORAGE_KEYS.DESC_CACHE];
  return raw && typeof raw === 'object' ? raw : {};
}

export async function saveDescCache(map) {
  // Trim to keep chrome.storage.local size manageable. Descriptions never
  // change, so eviction order doesn't matter much.
  const entries = Object.entries(map);
  const trimmed =
    entries.length > DESC_CACHE_MAX
      ? Object.fromEntries(entries.slice(-DESC_CACHE_MAX))
      : map;
  await set({ [STORAGE_KEYS.DESC_CACHE]: trimmed });
}

// Persistent inspect cache: assetid → { floatValue, paintSeed, paintIndex,
// defIndex, stickers, keychains }. A specific asset's inspect data never
// changes, so cached entries are permanently valid. Trimmed to a max size
// (FIFO by insertion order — recent trades stay hot).
const INSPECT_CACHE_MAX = 3000;

export async function getInspectCache() {
  const data = await get([STORAGE_KEYS.INSPECT_CACHE]);
  const raw = data[STORAGE_KEYS.INSPECT_CACHE];
  return raw && typeof raw === 'object' ? raw : {};
}

export async function saveInspectCache(map) {
  const entries = Object.entries(map);
  const trimmed =
    entries.length > INSPECT_CACHE_MAX
      ? Object.fromEntries(entries.slice(-INSPECT_CACHE_MAX))
      : map;
  await set({ [STORAGE_KEYS.INSPECT_CACHE]: trimmed });
}

const ACTIVITY_MAX = 50;

export async function pushActivity(entry) {
  const data = await get([STORAGE_KEYS.ACTIVITY_LOG]);
  const existing = Array.isArray(data[STORAGE_KEYS.ACTIVITY_LOG])
    ? data[STORAGE_KEYS.ACTIVITY_LOG]
    : [];
  const next = [{ ...entry, at: Date.now() }, ...existing].slice(0, ACTIVITY_MAX);
  await set({ [STORAGE_KEYS.ACTIVITY_LOG]: next });
}

export async function getActivity() {
  const data = await get([STORAGE_KEYS.ACTIVITY_LOG]);
  return Array.isArray(data[STORAGE_KEYS.ACTIVITY_LOG]) ? data[STORAGE_KEYS.ACTIVITY_LOG] : [];
}
