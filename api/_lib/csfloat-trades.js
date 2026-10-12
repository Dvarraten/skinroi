// CSFloat trade history → buy/sell prices for pending items.
//
// Uses CSFloat's undocumented GET /api/v1/me/trades (the same endpoint
// CSFloat's own browser extension uses), authenticated with the account's API
// key from CSFLOAT_API_KEY. Each trade carries the Steam trade offer id it was
// settled through (steam_offer.id), which is the same value the extension
// stores as `tradeid` on every pending item — so prices can be joined
// directly onto Handle Items.
//
// Results are cached in Redis for CACHE_TTL_S so the frontend's pending-list
// poll doesn't hit CSFloat on every request.

import { getRedis } from './redis.js';

const API_BASE = 'https://csfloat.com/api/v1/me/trades';
const PAGE_LIMIT = 100;
const MAX_PAGES = 3;
// Accepted trades sit in `pending` while Steam's trade protection window runs,
// and move to `verified` once CSFloat confirms them.
const STATES = ['pending', 'verified'];
const CACHE_TTL_S = 120;
const CACHE_KEY = (steamId) => `skinroi:csfloat:trades:${steamId}`;

async function fetchTradesPage(apiKey, state, page) {
  const url = `${API_BASE}?state=${state}&limit=${PAGE_LIMIT}&page=${page}`;
  const resp = await fetch(url, {
    headers: { Authorization: apiKey, Accept: 'application/json' },
  });
  if (!resp.ok) throw new Error(`CSFloat /me/trades ${state} p${page}: HTTP ${resp.status}`);
  const json = await resp.json();
  return Array.isArray(json?.trades) ? json.trades : [];
}

// Reduce a raw CSFloat trade to what Handle Items needs, from the point of view
// of `steamId`. Returns null for trades that don't involve that account.
function slimTrade(t, steamId) {
  const offerId = t?.steam_offer?.id != null ? String(t.steam_offer.id) : '';
  const cents = Number(t?.contract?.price);
  if (!offerId || !Number.isFinite(cents) || cents <= 0) return null;

  let side = null;
  if (String(t.buyer_id) === steamId) side = 'incoming';
  else if (String(t.seller_id) === steamId) side = 'outgoing';
  if (!side) return null;

  const item = t.contract.item || {};
  return {
    offerId,
    side,
    priceUsd: Math.round(cents) / 100,
    assetId: item.asset_id != null ? String(item.asset_id) : '',
    marketHashName: typeof item.market_hash_name === 'string' ? item.market_hash_name : '',
    csfloatTradeId: String(t.id),
  };
}

async function fetchAllTrades(apiKey, steamId) {
  const out = [];
  for (const state of STATES) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const trades = await fetchTradesPage(apiKey, state, page);
      for (const t of trades) {
        const slim = slimTrade(t, steamId);
        if (slim) out.push(slim);
      }
      if (trades.length < PAGE_LIMIT) break;
    }
  }
  return out;
}

// Returns the slim CSFloat trades for `steamId`, from cache when fresh.
// Never throws: a missing key or a CSFloat outage just yields [].
export async function loadCsfloatTrades(steamId) {
  const apiKey = process.env.CSFLOAT_API_KEY;
  if (!apiKey || !steamId) return [];

  const redis = getRedis();
  try {
    const cached = await redis.get(CACHE_KEY(steamId));
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch (err) {
    console.warn('[csfloat-trades] cache read failed:', err.message || err);
  }

  try {
    const trades = await fetchAllTrades(apiKey, steamId);
    await redis.set(CACHE_KEY(steamId), trades, { ex: CACHE_TTL_S });
    return trades;
  } catch (err) {
    console.warn('[csfloat-trades] fetch failed:', err.message || err);
    return [];
  }
}

// Adds `csfloatPrice` (USD) to each pending item whose Steam trade offer was
// a CSFloat trade on the matching side. Returns a new array; the stored state
// is left untouched.
//
// One Steam offer can settle several CSFloat trades (bulk buys/sells), so
// within an offer we match on assetid first — stable for outgoing items — and
// fall back to market_hash_name, since incoming items get a new assetid once
// they land in the inventory. Each CSFloat trade is used at most once.
export function attachCsfloatPrices(pending, trades) {
  if (!Array.isArray(pending) || pending.length === 0 || trades.length === 0) return pending;

  const byOffer = new Map();
  for (const t of trades) {
    const key = `${t.side}:${t.offerId}`;
    if (!byOffer.has(key)) byOffer.set(key, []);
    byOffer.get(key).push(t);
  }

  // Two passes so an exact assetid match always wins over a name match that
  // an earlier pending item could otherwise have claimed.
  const used = new Set();
  const prices = new Array(pending.length).fill(null);
  const matchPass = (predicate) => {
    pending.forEach((p, i) => {
      if (prices[i] != null || !p?.tradeid) return;
      const candidates = byOffer.get(`${p.type}:${p.tradeid}`);
      const hit = candidates?.find((t) => !used.has(t.csfloatTradeId) && predicate(t, p));
      if (!hit) return;
      used.add(hit.csfloatTradeId);
      prices[i] = hit.priceUsd;
    });
  };
  matchPass((t, p) => t.assetId && t.assetId === String(p.assetid));
  matchPass((t, p) => t.marketHashName && t.marketHashName === p.marketHashName);

  return pending.map((p, i) => (prices[i] != null ? { ...p, csfloatPrice: prices[i] } : p));
}
