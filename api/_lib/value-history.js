// Daily portfolio value snapshots, for the "Portfolio value" chart on
// Analytics. The site works out today's figures from the sell prices it
// already shows on Portfolio and posts them here; the server only stores
// one row per day.
//
// Served from /api/items?history=1 (the Vercel Hobby plan allows only 12
// functions, so this can't be its own route). Session cookie only.
//   GET  → { history: [{ d, cost, market, priced, count }] }, oldest first
//   POST { snapshot: { d, cost, market, priced, count } } → { ok, changed }
//
// Redis budget: one small key per user (≤ 730 rows, ~45 KB at most). The
// site posts at most every 6 h, and an unchanged row is never rewritten.

import { getRedis } from './redis.js';
import { getSessionSteamId } from './auth.js';

export const MAX_DAYS = 730;
const key = (steamId) => `skinroi:valuehist:${steamId}`;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const money = (v) => (Number.isFinite(v) && v >= 0 && v < 1e9 ? Math.round(v * 100) / 100 : null);
const count = (v) => (Number.isInteger(v) && v >= 0 && v < 1e6 ? v : null);

// A posted snapshot, cleaned, or null if it isn't one. The day is the
// browser's local date, so it may be a day ahead of or behind UTC.
export function cleanSnapshot(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || !DAY_RE.test(raw.d)) return null;
  const dayStart = Date.parse(`${raw.d}T00:00:00Z`);
  if (!Number.isFinite(dayStart) || Math.abs(dayStart - now) > 2 * DAY_MS) return null;
  const snap = {
    d: raw.d,
    cost: money(raw.cost),
    market: money(raw.market),
    priced: count(raw.priced),
    count: count(raw.count),
  };
  if (snap.cost == null || snap.market == null || snap.priced == null || snap.count == null) return null;
  if (snap.priced > snap.count) return null;
  return snap;
}

// Replaces or adds the row for snap.d, keeps rows sorted and at most `max`.
export function upsertSnapshot(history, snap, max = MAX_DAYS) {
  const rows = Array.isArray(history) ? history.filter((r) => r && DAY_RE.test(r.d)) : [];
  const i = rows.findIndex((r) => r.d === snap.d);
  if (i >= 0 && ['cost', 'market', 'priced', 'count'].every((k) => rows[i][k] === snap[k])) {
    return { history: rows, changed: false };
  }
  if (i >= 0) rows[i] = snap;
  else rows.push(snap);
  rows.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return { history: rows.slice(-max), changed: true };
}

export async function handleValueHistory(req, res) {
  const steamId = getSessionSteamId(req);
  if (!steamId) return res.status(401).json({ error: 'not authenticated' });
  res.setHeader('Cache-Control', 'no-store');
  const redis = getRedis();

  if (req.method === 'GET') {
    const raw = await redis.get(key(steamId));
    return res.json({ history: Array.isArray(raw) ? raw : [] });
  }

  if (req.method === 'POST') {
    const snap = cleanSnapshot(req.body?.snapshot);
    if (!snap) return res.status(400).json({ error: 'invalid snapshot' });
    const { history, changed } = upsertSnapshot(await redis.get(key(steamId)), snap);
    if (changed) await redis.set(key(steamId), history);
    return res.json({ ok: true, changed });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
