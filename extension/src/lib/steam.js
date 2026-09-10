// Steam integration — reads the user's session cookie, extracts a WebAPI
// access token from the logged-in Steam session, and fetches accepted
// trades via IEconService/GetTradeOffers.
//
// Note: Steam's `GetTradeHistory/v1/` returns an empty response with the
// session-derived tokens we can access, so we can't use it. `GetTradeOffers`
// works with the pointssummary/loyalty token and returns each trade's
// tradeofferid, state, and items list — enough for our dedup + surfacing.

import {
  STEAM_HOME,
  STEAM_POINTS_CONFIG,
  STEAM_GET_TRADE_OFFERS,
  STEAM_OFFER_STATE_ACCEPTED,
  CS2_APP_ID,
} from './config.js';

// Read the Steam ID out of the steamLoginSecure cookie. Format: "{id}||{jwt}".
// Returns null if the user isn't logged into Steam in this browser.
export async function getSteamIdFromCookie() {
  return new Promise((resolve) => {
    chrome.cookies.get(
      { url: 'https://steamcommunity.com', name: 'steamLoginSecure' },
      (cookie) => {
        if (!cookie || !cookie.value) return resolve(null);
        const decoded = decodeURIComponent(cookie.value);
        const [steamId] = decoded.split('||');
        if (!/^\d{17}$/.test(steamId || '')) return resolve(null);
        resolve(steamId);
      }
    );
  });
}

// Fetch a session-derived WebAPI access token that grants access to
// IEconService/GetTradeOffers for the logged-in user.
//
// Primary source: /pointssummary/ajaxgetasyncconfig returns
//   { "success": true, "data": { "webapi_token": "..." } }
// Fallback: parse `data-loyalty_webapi_token` from /my/home/ HTML.
export async function fetchSessionAccessToken() {
  try {
    const res = await fetch(STEAM_POINTS_CONFIG, {
      credentials: 'include',
      redirect: 'follow',
    });
    if (res.ok) {
      const json = await res.json();
      const token =
        (json?.data && (json.data.webapi_token || json.data.access_token)) ||
        json?.webapi_token ||
        null;
      if (token && typeof token === 'string') return token.trim();
    }
  } catch {
    // fall through to HTML parse
  }

  const home = await fetch(STEAM_HOME, { credentials: 'include', redirect: 'follow' });
  if (!home.ok) throw new Error(`Steam session fetch failed: HTTP ${home.status}`);
  const html = await home.text();
  const m =
    html.match(/data-loyalty_webapi_token\s*=\s*&quot;([^&]+)&quot;/i) ||
    html.match(/data-loyalty_webapi_token\s*=\s*"([^"]+)"/i);
  if (!m) {
    throw new Error(
      'Could not read Steam WebAPI token — sign in to Steam in this browser and try again.'
    );
  }
  return m[1].replace(/&quot;/g, '').trim();
}

// Fetch trade offers, deduped across three filter modes. Each mode returns
// a different slice of the user's offers; merging them covers all state 3
// (Accepted) trades. Descriptions come back in `response.descriptions`.
export async function fetchAcceptedTradeOffers(token, { maxPagesPerMode = 30 } = {}) {
  const descByKey = new Map();
  const offersById = new Map();

  const futureCutoff = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const modes = [
    { active_only: 'false', historical_only: 'false', time_historical_cutoff: '0' },
    { active_only: 'false', historical_only: 'true', time_historical_cutoff: '0' },
    { active_only: 'true', historical_only: 'false', time_historical_cutoff: String(futureCutoff) },
  ];

  for (const mode of modes) {
    let cursor = 0;
    let pages = 0;
    for (;;) {
      if (pages >= maxPagesPerMode) break;
      const params = new URLSearchParams({
        access_token: token,
        get_sent_offers: 'true',
        get_received_offers: 'true',
        get_descriptions: 'true',
        language: 'english',
        ...mode,
        cursor: String(cursor),
      });
      const url = `${STEAM_GET_TRADE_OFFERS}?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`GetTradeOffers HTTP ${res.status}`);
      const json = await res.json();
      const resp = json.response || {};

      for (const d of resp.descriptions || []) {
        const classid = d.classid != null ? String(d.classid) : '';
        if (!classid) continue;
        const instanceid = d.instanceid != null ? String(d.instanceid) : '0';
        const key = `${classid}_${instanceid}`;
        if (!descByKey.has(key)) descByKey.set(key, d);
      }

      for (const list of [resp.trade_offers_sent, resp.trade_offers_received]) {
        if (!Array.isArray(list)) continue;
        for (const o of list) {
          const id = o?.tradeofferid != null ? String(o.tradeofferid) : '';
          if (!id) continue;
          if (!offersById.has(id)) offersById.set(id, o);
        }
      }

      const next = Number(resp.next_cursor);
      pages += 1;
      if (!Number.isFinite(next) || next <= 0) break;
      cursor = next;
    }
  }

  return { offers: [...offersById.values()], descByKey };
}

// Fallback description source: fetch the user's inventory (ctx 2 + ctx 16)
// and index descriptions by classid_instanceid. Trade offers don't always
// include descriptions, but items INCOMING land in the user's inventory —
// in ctx 16 during 7-day hold, ctx 2 once tradeable — so we can look them
// up here. Outgoing items were in the inventory before they left; caching
// this map across syncs covers them.
export async function fetchInventoryDescriptions(steamId) {
  const out = new Map();
  for (const ctx of [2, 16]) {
    try {
      let start = '';
      for (let page = 0; page < 6; page++) {
        const url =
          `https://steamcommunity.com/inventory/${steamId}/${CS2_APP_ID}/${ctx}/?l=english&count=2000` +
          (start ? `&start_assetid=${encodeURIComponent(start)}` : '');
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) break;
        const body = await res.json();
        for (const d of body.descriptions || []) {
          const classid = d.classid != null ? String(d.classid) : '';
          if (!classid) continue;
          const instanceid = d.instanceid != null ? String(d.instanceid) : '0';
          const key = `${classid}_${instanceid}`;
          if (!out.has(key)) out.set(key, d);
        }
        if (!body.more_items || !body.last_assetid) break;
        start = String(body.last_assetid);
      }
    } catch {
      // move on to next ctx on failure
    }
  }
  return out;
}

// Turn Steam's raw offer objects into the shape we push to the backend:
//   { tradeofferid, acceptedAt, items: [{ type, assetid, marketHashName, iconUrl }] }
//
// No time filter — trade detection relies on backend tradeofferid dedup
// (processedTradeIds) which is seeded on first pair via a baseline push.
// A time filter here would drop long-standing offers accepted after pairing
// (their `time_created` predates the pair), which is a legitimate new trade.
export function normalizeAcceptedOffers(rawOffers, descByKey) {
  const seenOfferIds = new Set();
  const out = [];

  for (const raw of rawOffers || []) {
    if (!raw || typeof raw !== 'object') continue;
    if (Number(raw.trade_offer_state) !== STEAM_OFFER_STATE_ACCEPTED) continue;

    const tradeofferid = raw.tradeofferid != null ? String(raw.tradeofferid).trim() : '';
    if (!tradeofferid) continue;
    if (seenOfferIds.has(tradeofferid)) continue;
    seenOfferIds.add(tradeofferid);

    const createdSec = Number(raw.time_created) || 0;
    const updatedSec = Number(raw.time_updated) || createdSec;
    const acceptedAt =
      updatedSec > 0 ? new Date(updatedSec * 1000).toISOString() : new Date().toISOString();

    const items = [];
    collectItems(raw.items_to_receive, 'incoming', descByKey, items);
    collectItems(raw.items_to_give, 'outgoing', descByKey, items);

    if (items.length === 0) continue;
    out.push({ tradeofferid, acceptedAt, items });
  }

  return out;
}

// For baseline seed: collect ALL state=3 tradeofferids (regardless of
// description resolution) so the backend can mark them as processed and
// subsequent polls only surface truly-new trades.
export function collectAllAcceptedTradeIds(rawOffers) {
  const out = [];
  const seen = new Set();
  for (const raw of rawOffers || []) {
    if (!raw || typeof raw !== 'object') continue;
    if (Number(raw.trade_offer_state) !== STEAM_OFFER_STATE_ACCEPTED) continue;
    const tradeofferid = raw.tradeofferid != null ? String(raw.tradeofferid).trim() : '';
    if (!tradeofferid) continue;
    if (seen.has(tradeofferid)) continue;
    seen.add(tradeofferid);
    const createdSec = Number(raw.time_created) || 0;
    const updatedSec = Number(raw.time_updated) || createdSec;
    const acceptedAt =
      updatedSec > 0 ? new Date(updatedSec * 1000).toISOString() : new Date().toISOString();
    out.push({ tradeofferid, acceptedAt, items: [] });
  }
  return out;
}

function collectItems(rawItems, type, descByKey, sink) {
  if (!Array.isArray(rawItems)) return;
  for (const it of rawItems) {
    if (!it || typeof it !== 'object') continue;
    const appidRaw = it.appid;
    if (appidRaw != null && String(appidRaw) !== String(CS2_APP_ID)) continue;

    const classid = it.classid != null ? String(it.classid) : '';
    if (!classid) continue;
    const instanceid = it.instanceid != null ? String(it.instanceid) : '0';
    const desc = descByKey.get(`${classid}_${instanceid}`);
    const marketHashName = (desc?.market_hash_name || desc?.name || '').trim();

    const assetid = it.assetid != null ? String(it.assetid) : '';
    if (!assetid) continue;
    // Drop items we can't name yet. Steam's inventory endpoint sometimes
    // takes a few minutes to propagate a just-received item's description,
    // especially for unique-classid items like Souvenir skins. The 2-min
    // background poll retries automatically; users can add anything the
    // extension permanently missed via the manual Add form.
    if (!marketHashName) continue;

    sink.push({
      type,
      assetid,
      classid,
      instanceid,
      marketHashName,
      iconUrl: desc?.icon_url ? String(desc.icon_url) : '',
    });
  }
}
