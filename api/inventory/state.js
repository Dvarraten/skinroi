// GET /api/inventory/state
//
// Returns the current pending list + extension connection info. The pending
// list is written by /api/extension/trades; this endpoint is read-only.
//
// Pending items that came from a CSFloat trade are enriched with
// `csfloatPrice` (USD) so Handle Items can prefill the buy/sell price. The
// enrichment is response-only and never written back to the stored state.
//
// GET ?steamInventory=1 — the signed-in user's public CS2 inventory for the
// one-click import on Add item (see _lib/steam-inventory.js). Lives here
// because the Vercel Hobby plan allows 12 functions.

import { loadState, publicState } from '../_lib/state.js';
import { getSessionSteamId } from '../_lib/auth.js';
import { loadExtensionInfo } from '../_lib/extension-store.js';
import { loadCsfloatTrades, attachCsfloatPrices } from '../_lib/csfloat-trades.js';
import { loadSteamInventory } from '../_lib/steam-inventory.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const steamId = getSessionSteamId(req) || null;

  if (req.query?.steamInventory) {
    if (!steamId) return res.status(401).json({ error: 'not authenticated' });
    res.setHeader('Cache-Control', 'no-store');
    try {
      return res.json(await loadSteamInventory(steamId, { fresh: req.query.fresh === '1' }));
    } catch (err) {
      console.error('[inventory] steam inventory failed:', err.message);
      return res.status(err.status || 500).json({ error: err.message, code: err.code || 'error' });
    }
  }

  try {
    const [state, extInfo, csfloatTrades] = await Promise.all([
      loadState(steamId),
      steamId ? loadExtensionInfo(steamId) : Promise.resolve(null),
      steamId ? loadCsfloatTrades(steamId) : Promise.resolve([]),
    ]);

    const extension = extInfo
      ? {
          connected: true,
          extVersion: extInfo.extVersion,
          pairedAt: extInfo.pairedAt,
          lastSeen: extInfo.lastSeen,
        }
      : { connected: false, extVersion: null, pairedAt: null, lastSeen: null };

    res.setHeader('Cache-Control', 'no-store');
    const pending = attachCsfloatPrices(state.pending, csfloatTrades);

    res.status(200).json(publicState({ ...state, pending }, { extension }));
  } catch (err) {
    return res.status(500).json({
      error: err.message || String(err),
      hint: 'Check that KV_REST_API_* (or UPSTASH_REDIS_REST_*) env vars are set in Vercel',
    });
  }
}
