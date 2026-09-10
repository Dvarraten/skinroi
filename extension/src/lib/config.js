// Runtime config for the extension. The base URL can be overridden via the
// popup's dev settings so the same build can point at localhost during
// development or the deployed Vercel app.

export const DEFAULT_BASE_URL = 'https://skinroi.vercel.app';
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
  ACTIVITY_LOG: 'activity_log',
};
