// Sell prices for the items a user currently owns: lowest YouPin and CSFloat
// listing per item, shown on Home so the user can compare where to sell.
//
// - YouPin comes from SteamDT's open API (STEAMDT_API_KEY, same source and
//   30 min cache as the Snipes reference prices). It is read on every GET, so
//   it needs no extension and never touches the user's YouPin account.
// - CSFloat rate-limits Vercel's many IPs, so the SkinROI extension fetches
//   those from the user's own browser and pushes them here.
//
// Served from /api/items?sellPrices=1 (the Vercel Hobby plan allows only 12
// functions, so this can't be its own route):
//   GET  — session cookie (site) or Bearer secret (extension):
//          { names, targets, prices, status }. Prices are keyed by target
//          key: the market_hash_name, plus "|Phase 2" etc. for Dopplers (see
//          doppler-phase.js). The extension uses it to see which keys are
//          due for a refresh; the site uses it to render prices
//          (prices[key].youpin is filled in from SteamDT on the fly).
//          SteamDT has no per-phase prices, so a Doppler's YouPin price is
//          the lowest of any phase, flagged anyPhase so the site says so.
//   POST — Bearer secret only. Body: { results: [{ name, market, priceUsd?,
//          priceCny?, count?, error? }], status?: { [market]: errorText|null } }

import { getRedis } from './redis.js';
import { getSessionSteamId } from './auth.js';
import { extractBearer, resolveSecret } from './extension-store.js';
import { getCnyPerUsd } from './snipes/fx.js';
import { loadSteamDtRows } from './snipes/reference.js';
import { sellPriceTarget, needsPhase } from './doppler-phase.js';

// Markets the extension pushes. YouPin is added server-side on GET.
export const MARKETS = ['csfloat'];
const MAX_RESULTS = 1000;

const key = (steamId) => `skinroi:sellprices:${steamId}`;
const itemsKey = (steamId) => `skinroi:items:${steamId}`;

// One price target per distinct item+phase the user still owns (unsold, not
// cash transactions), sorted by key.
export function ownedTargets(items) {
  const byKey = new Map();
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || it.sold || it.isTransaction) continue;
    const t = sellPriceTarget(it);
    if (!t.name) continue;
    const prev = byKey.get(t.key);
    if (!prev || (prev.paintIndex == null && t.paintIndex != null)) byKey.set(t.key, t);
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
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
        ...(r.anyPhase ? { anyPhase: true } : {}),
        at: now,
        checkedAt: now,
      };
    }
    prices[r.name] = { ...(prices[r.name] || {}), [r.market]: next };
  }
  return prices;
}

// YouPin lowest listing per target from SteamDT rows (CNY → USD). Keyed by
// target key. SteamDT doesn't split Dopplers by phase, so theirs is the
// lowest listing of any phase and is flagged anyPhase.
export async function youpinPrices(redis, targets) {
  const now = Date.now();
  let raw = new Map();
  let warning = null;
  try {
    ({ raw, warning } = await loadSteamDtRows(redis, [...new Set(targets.map((t) => t.name))]));
  } catch (e) {
    warning = e.message;
  }
  const cnyPerUsd = raw.size ? await getCnyPerUsd() : 1;
  const prices = {};
  for (const t of targets) {
    const entry = raw.get(t.name);
    if (!entry) continue;
    const name = t.key;
    const row = entry.youpin;
    prices[name] = {
      priceUsd: row?.sell ? Math.round((row.sell / cnyPerUsd) * 100) / 100 : null,
      count: row ? row.sellCount ?? null : 0,
      ...(needsPhase(t.name) ? { anyPhase: true } : {}),
      at: entry.at,
      checkedAt: entry.at,
    };
  }
  return { prices, status: warning ? { ok: false, error: warning, at: now } : { ok: true, at: now } };
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
  const targets = ownedTargets(items);
  const names = targets.map((t) => t.key);

  if (req.method === 'GET') {
    const prices = { ...(stored?.prices || {}) };
    const status = { ...(stored?.status || {}) };
    // The extension only needs names + its own markets; skip SteamDT for it.
    if (!bearer) {
      const youpin = await youpinPrices(redis, targets);
      for (const [name, entry] of Object.entries(youpin.prices)) {
        prices[name] = { ...(prices[name] || {}), youpin: entry };
      }
      status.youpin = youpin.status;
    }
    return res.json({ names, targets, prices, status });
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
