// Sell prices for the items a user currently owns: lowest Buff163 and CSFloat
// listing per item, shown on Home so the user can compare where to sell.
//
// The server never fetches these itself. CSFloat rate-limits Vercel's many
// IPs, and Buff163 only answers logged-in browser sessions, so the SkinROI
// extension fetches them from the user's own browser and pushes them here.
//
// Served from /api/items?sellPrices=1 (the Vercel Hobby plan allows only 12
// functions, so this can't be its own route):
//   GET  — session cookie (site) or Bearer secret (extension):
//          { names, prices, status }. The extension uses it to see which
//          names are due for a refresh; the site uses it to render prices.
//   POST — Bearer secret only. Body: { results: [{ name, market, priceUsd?,
//          priceCny?, count?, error? }], status?: { [market]: errorText|null } }

import { getRedis } from './redis.js';
import { getSessionSteamId } from './auth.js';
import { extractBearer, resolveSecret } from './extension-store.js';
import { getCnyPerUsd } from './snipes/fx.js';

export const MARKETS = ['buff163', 'csfloat'];
const MAX_RESULTS = 1000; // Buff163 prices every owned item in one push

const key = (steamId) => `skinroi:sellprices:${steamId}`;
const itemsKey = (steamId) => `skinroi:items:${steamId}`;

// Unique names of items the user still owns (unsold, not cash transactions).
export function ownedNames(items) {
  const names = new Set();
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || it.sold || it.isTransaction) continue;
    const name = typeof it.itemName === 'string' ? it.itemName.trim() : '';
    if (name) names.add(name);
  }
  return [...names].sort();
}

// Merges pushed results into the stored price map. Pure, so it can be tested.
// A failed lookup keeps the last good price (its age still shows) and records
// the error; names the user no longer owns are dropped.
export function mergeResults(stored, results, names, cnyPerUsd, now) {
  const owned = new Set(names);
  const prices = {};
  for (const [name, entry] of Object.entries(stored?.prices || {})) {
    if (owned.has(name)) prices[name] = entry;
  }
  for (const r of results) {
    if (!r || !owned.has(r.name) || !MARKETS.includes(r.market)) continue;
    const prev = prices[r.name]?.[r.market] || {};
    let next;
    if (r.error) {
      next = { ...prev, error: String(r.error).slice(0, 120), checkedAt: now };
    } else {
      const usd = toPrice(r.priceUsd) ?? (toPrice(r.priceCny) != null ? r.priceCny / cnyPerUsd : null);
      next = {
        priceUsd: usd != null ? Math.round(usd * 100) / 100 : null, // null = no listings
        count: Number.isFinite(Number(r.count)) ? Number(r.count) : null,
        at: now,
        checkedAt: now,
      };
    }
    prices[r.name] = { ...(prices[r.name] || {}), [r.market]: next };
  }
  return prices;
}

function toPrice(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function handleSellPrices(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const bearer = extractBearer(req);
  const steamId = bearer ? await resolveSecret(bearer) : getSessionSteamId(req);
  if (!steamId) return res.status(401).json({ error: 'not authenticated' });

  const redis = getRedis();
  const [items, stored] = await redis.mget(itemsKey(steamId), key(steamId));
  const names = ownedNames(items);

  if (req.method === 'GET') {
    return res.json({ names, prices: stored?.prices || {}, status: stored?.status || {} });
  }

  if (req.method === 'POST') {
    if (!bearer) return res.status(401).json({ error: 'extension only' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const results = Array.isArray(body.results) ? body.results.slice(0, MAX_RESULTS) : [];
    const now = Date.now();
    const cnyPerUsd = results.some((r) => r?.priceCny != null) ? await getCnyPerUsd() : 1;

    const status = { ...(stored?.status || {}) };
    for (const m of MARKETS) {
      if (body.status && m in body.status) {
        const err = body.status[m];
        status[m] = err ? { ok: false, error: String(err).slice(0, 160), at: now } : { ok: true, at: now };
      }
    }

    const prices = mergeResults(stored, results, names, cnyPerUsd, now);
    await redis.set(key(steamId), { prices, status });
    return res.json({ ok: true, saved: results.length });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
