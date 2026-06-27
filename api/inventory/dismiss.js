// POST /api/inventory/dismiss   body: { assetid: string, type?: 'incoming'|'outgoing' }
//
// Removes a pending event so it no longer shows in the modal.

import { loadState, saveState } from '../_lib/state.js';
import { getSessionSteamId } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const steamId = getSessionSteamId(req) || null;
  if (!steamId) {
    return res.status(401).json({ ok: false, error: 'not logged in' });
  }

  // Vercel Node functions auto-parse JSON, but be defensive.
  const body =
    req.body && typeof req.body === 'object'
      ? req.body
      : (() => {
          try { return JSON.parse(req.body || '{}'); } catch { return {}; }
        })();

  const assetid = typeof body.assetid === 'string' ? body.assetid : null;
  const type = body.type === 'incoming' || body.type === 'outgoing' ? body.type : null;

  if (!assetid) {
    return res.status(400).json({ error: 'assetid (string) required' });
  }

  try {
    const state = await loadState(steamId);
    const before = state.pending.length;

    // Mark the dismissed item's trade as processed so sync never re-queues it.
    const dismissedTradeIds = state.pending
      .filter((p) => type ? (p.assetid === assetid && p.type === type) : p.assetid === assetid)
      .map((p) => p.tradeid)
      .filter(Boolean);
    const existing = state.processedTradeIds || [];
    const processedTradeIds = dismissedTradeIds.length
      ? [...new Set([...existing, ...dismissedTradeIds])].slice(-500)
      : existing;

    // Tombstone the assetid so the sync's fresh-reload path can't race it back
    // into pending. Keyed as "type:assetid" so an incoming tombstone never
    // blocks an outgoing detection of the same item. Capped at 2000 entries.
    const tombstoneKey = type ? `${type}:${assetid}` : assetid;
    const dismissedAssetIds = [
      ...new Set([...(state.dismissedAssetIds || []), tombstoneKey]),
    ].slice(-2000);

    // Fresh reload before saving so a concurrent sync write doesn't clobber us.
    const fresh = await loadState(steamId);
    const newPending = fresh.pending.filter((p) =>
      type ? !(p.assetid === assetid && p.type === type) : p.assetid !== assetid
    );
    const next = {
      ...fresh,
      pending: newPending,
      processedTradeIds: [...new Set([...(fresh.processedTradeIds || []), ...processedTradeIds])].slice(-500),
      dismissedAssetIds,
    };
    await saveState(next, steamId);

    return res.status(200).json({
      ok: true,
      removed: before - newPending.length,
      pending: next.pending,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
