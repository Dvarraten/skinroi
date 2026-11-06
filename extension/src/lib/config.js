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
export const STEAM_GET_ASSET_CLASS_INFO = 'https://api.steampowered.com/ISteamEconomy/GetAssetClassInfo/v1/';
export const STEAM_GET_TRADE_STATUS = 'https://api.steampowered.com/IEconService/GetTradeStatus/v1/';

// CSFloat's public inspect endpoint — takes a Steam inspect_link, returns
// float value, paint seed / index, stickers, keychains. Same API their own
// browser extension uses. Only items from trades since pairing are inspected,
// at most INSPECT_MAX_PER_RUN new ones per poll, 2 s apart; a failed lookup
// is not retried for INSPECT_RETRY_FAILED_MS (traded-away items always fail).
export const CSFLOAT_INSPECT_API = 'https://api.csfloat.com/';
export const INSPECT_MIN_DELAY_MS = 2000;
export const INSPECT_MAX_PER_RUN = 5;
export const INSPECT_RETRY_FAILED_MS = 24 * 60 * 60 * 1000;

// Newest CSFloat buy-now listings for the Snipes tab. Fetched here rather than
// on the server because CSFloat rate-limits requests coming from many IPs
// (Vercel functions); the extension runs on the user's single IP.
export const CSFLOAT_LISTINGS_URL =
  'https://csfloat.com/api/v1/listings?sort_by=most_recent&type=buy_now&limit=50';
// Per-item lookups of an item's cheapest CSFloat listing (lib/snipelookups.js)
// per poll; the backend asks for at most this many per push.
export const SNIPE_LOOKUPS_PER_RUN = 3;

// Every csfloat.com/api/v1/listings call goes through lib/csfloat.js, which
// spaces them CSFLOAT_MIN_GAP_MS apart (4 a minute; CSFloat allows about 5)
// and pauses all of them after a 429: until Retry-After / X-RateLimit-Reset,
// else 10 min, doubling for each 429 in a row, at most 60 min.
// Per 2-minute poll: 1 Snipes feed + 3 lookups + 4 sell-price calls = 8.
export const CSFLOAT_MIN_GAP_MS = 15 * 1000;
export const CSFLOAT_PAUSE_MIN_MS = 10 * 60 * 1000;
export const CSFLOAT_PAUSE_MAX_MS = 60 * 60 * 1000;

// CSFloat sell prices for Home (see lib/sellprices.js): at most
// SELL_PRICES_CALLS_PER_RUN CSFloat calls each poll (a Doppler can need more
// than one); a price is refreshed once it is 30 min
// old so the site (which hides prices older than 1 hour) always has a fresh one.
export const CSFLOAT_LISTINGS_API = 'https://csfloat.com/api/v1/listings';
export const SELL_PRICES_CALLS_PER_RUN = 4;
export const SELL_PRICES_REFRESH_AFTER_MS = 30 * 60 * 1000;
export const SELL_PRICES_RETRY_ERROR_MS = 10 * 60 * 1000;

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
  DESC_CACHE: 'skinroi_descCache',
  INSPECT_CACHE: 'skinroi_inspectCache',
  ACTIVITY_LOG: 'activity_log',
  VERBOSE_LOGGING: 'skinroi_verboseLogging',
};
