// Runtime config for the extension. The base URL can be overridden via the
// popup's dev settings so the same build can point at localhost during
// development or the deployed Vercel app.

// Primary custom domain; www is the one that serves the app directly
// (apex skinroi.com issues a 307 to www, and Chrome strips the Bearer
// header across cross-origin redirects).
export const DEFAULT_BASE_URL = 'https://www.skinroi.com';
export const EXT_VERSION = chrome.runtime.getManifest().version;

// How often the background service worker polls Steam for changes.
// Chrome's alarms API enforces a 1-minute minimum for unpacked extensions
// (30s in dev — see chrome://extensions).
export const POLL_INTERVAL_MIN = 2;

// Steam endpoints called from the service worker.
export const STEAM_HOME = 'https://steamcommunity.com/my/home/';
export const STEAM_POINTS_CONFIG =
  'https://steamcommunity.com/pointssummary/ajaxgetasyncconfig';
export const STEAM_GET_TRADE_OFFERS = 'https://api.steampowered.com/IEconService/GetTradeOffers/v1/';
export const STEAM_GET_TRADE_HISTORY = 'https://api.steampowered.com/IEconService/GetTradeHistory/v1/';

// CSFloat's public inspect endpoint — takes a Steam inspect_link, returns
// float value, paint seed / index, stickers, keychains. Same API their own
// browser extension uses. Rate limits are lenient for a personal trader
// (a few trades per day), but we still throttle to be a good citizen.
export const CSFLOAT_INSPECT_API = 'https://api.csfloat.com/';
export const INSPECT_MIN_DELAY_MS = 250;

// Only offers in state 3 (Accepted) count as completed trades — items have
// transferred to inventory (possibly in trade-protected context 16 for the
// 7-day hold, but the trade itself is done and the item is ours).
export const STEAM_OFFER_STATE_ACCEPTED = 3;

// CS2 app id — we only surface items from Counter-Strike 2.
export const CS2_APP_ID = 730;

// Storage keys — everything the extension persists is under one of these
// namespaces in chrome.storage.local.
export const STORAGE_KEYS = {
  BASE_URL: 'skinroi_baseUrl',
  SECRET: 'skinroi_secret',
  STEAM_ID: 'skinroi_steamId',
  PAIRED_AT: 'skinroi_pairedAt',
  HAS_SEEDED_OFFERS: 'skinroi_hasSeededOffers',
  DESC_CACHE: 'skinroi_descCache',
  INSPECT_CACHE: 'skinroi_inspectCache',
  ACTIVITY_LOG: 'activity_log',
};
