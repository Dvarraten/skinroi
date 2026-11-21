// GET /api/items  — load items for the authenticated user
// POST /api/items — save (replace) items for the authenticated user
// /api/items?sellPrices=1 — YouPin/CSFloat sell prices for owned items
//                           (see _lib/sell-prices.js)
// /api/items?connections=1 — marketplace API keys (see _lib/connections.js)
// GET /api/items?v=1 — only the portfolio's version number (cheap check)
//
// Versioning: every save bumps skinroi:items-ver:{steamId}. GET returns
// { items, version }; POST sends { items, baseVersion } and gets 409
// { error: 'conflict', version } when another tab saved in between, so a
// stale tab can't overwrite newer edits. A POST without baseVersion (an
// older open tab) is still accepted.
import { getSessionSteamId } from '../_lib/auth.js';
import { handleSellPrices } from '../_lib/sell-prices.js';
import { handleConnections } from '../_lib/connections.js';
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

function versionKey(steamId) {
  return `skinroi:items-ver:${steamId}`;
}

// Legacy key used before the cs2-tracker → skinroi rename.
function legacyItemsKey(steamId) {
  return `cs2-tracker:items:${steamId}`;
}

export default async function handler(req, res) {
  if (req.query?.sellPrices) return handleSellPrices(req, res);
  if (req.query?.connections) return handleConnections(req, res);

  const steamId = getSessionSteamId(req);
  if (!steamId) return res.status(401).json({ error: 'not authenticated' });

  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET' && req.query?.v) {
    const version = Number(await getClient().get(versionKey(steamId))) || 0;
    return res.json({ version });
  }

  if (req.method === 'GET') {
    const client = getClient();
    const [raw, ver] = await client.mget(itemsKey(steamId), versionKey(steamId));
    const version = Number(ver) || 0;

    if (raw !== null) {
      return res.json({ items: Array.isArray(raw) ? raw : [], version });
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
    const baseVersion = req.body?.baseVersion;
    if (Number.isInteger(baseVersion)) {
      const current = Number(await client.get(versionKey(steamId))) || 0;
      if (current !== baseVersion) return res.status(409).json({ error: 'conflict', version: current });
    }
    const [, version] = await client.pipeline()
      .set(itemsKey(steamId), items)
      .incr(versionKey(steamId))
      .exec();
    return res.json({ ok: true, count: items.length, version: Number(version) || 0 });
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'method not allowed' });
}
