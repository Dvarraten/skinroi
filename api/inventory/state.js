// GET /api/inventory/state
//
// Returns the current pending list + extension connection info. The pending
// list is written by /api/extension/trades; this endpoint is read-only.

import { loadState, publicState } from '../_lib/state.js';
import { getSessionSteamId } from '../_lib/auth.js';
import { loadExtensionInfo } from '../_lib/extension-store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const steamId = getSessionSteamId(req) || null;

  try {
    const [state, extInfo] = await Promise.all([
      loadState(steamId),
      steamId ? loadExtensionInfo(steamId) : Promise.resolve(null),
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
    res.status(200).json(publicState(state, { extension }));
  } catch (err) {
    return res.status(500).json({
      error: err.message || String(err),
      hint: 'Check that KV_REST_API_* (or UPSTASH_REDIS_REST_*) env vars are set in Vercel',
    });
  }
}
