// GET /api/items  — load items for the authenticated user
// POST /api/items — save (replace) items for the authenticated user
// /api/items?sellPrices=1 — Buff163/CSFloat sell prices for owned items
//                           (see _lib/sell-prices.js)
import { getSessionSteamId } from '../_lib/auth.js';
import { handleSellPrices } from '../_lib/sell-prices.js';
import { Redis } from '@upstash/redis';

function getClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Upstash Redis env vars missing');
  return new Redis({ url, token });
}

function itemsKey(steamId) {
  return `skinroi:items:${steamId}`;
}

// Legacy key used before the cs2-tracker → skinroi rename.
function legacyItemsKey(steamId) {
  return `cs2-tracker:items:${steamId}`;
}

export default async function handler(req, res) {
  if (req.query?.sellPrices) return handleSellPrices(req, res);

  const steamId = getSessionSteamId(req);
  if (!steamId) return res.status(401).json({ error: 'not authenticated' });

  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const client = getClient();
    const raw = await client.get(itemsKey(steamId));

    if (raw !== null) {
      return res.json({ items: Array.isArray(raw) ? raw : [] });
    }

    // New key missing — check legacy key and migrate if found.
    const legacy = await client.get(legacyItemsKey(steamId));
    if (Array.isArray(legacy) && legacy.length > 0) {
      await client.set(itemsKey(steamId), legacy);
      await client.del(legacyItemsKey(steamId));
      return res.json({ items: legacy, migrated: true });
    }

    // Key has never been written — signal the client to migrate localStorage
    // items rather than overwrite with [].
    return res.json({ items: [], firstLogin: true });
  }

  if (req.method === 'POST') {
    const { items } = req.body || {};
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
    const client = getClient();
    await client.set(itemsKey(steamId), items);
    return res.json({ ok: true, count: items.length });
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'method not allowed' });
}
