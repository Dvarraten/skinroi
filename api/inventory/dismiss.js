// POST /api/inventory/dismiss
//
// Body shapes (both accepted):
//   { assetid: string, type?: 'incoming'|'outgoing' }   — single dismiss (legacy)
//   { items: [{ assetid: string, type?: 'incoming'|'outgoing' }, ...] } — batch
//
// Removes pending events so they no longer show in Handle Items. Batching
// matters because multiple parallel single-dismiss calls race on Redis
// load-modify-save; the client sends the whole set in one shot instead.

import { loadState, saveState } from '../_lib/state.js';
import { getSessionSteamId } from '../_lib/auth.js';

function normaliseEntry(raw) {
  const assetid = typeof raw?.assetid === 'string' ? raw.assetid : null;
  const type = raw?.type === 'incoming' || raw?.type === 'outgoing' ? raw.type : null;
  if (!assetid) return null;
  return { assetid, type };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const steamId = getSessionSteamId(req) || null;
  if (!steamId) {
    return res.status(401).json({ ok: false, error: 'not logged in' });
  }

  const body =
    req.body && typeof req.body === 'object'
      ? req.body
      : (() => {
          try { return JSON.parse(req.body || '{}'); } catch { return {}; }
        })();

  const items = Array.isArray(body.items)
    ? body.items.map(normaliseEntry).filter(Boolean)
    : [normaliseEntry(body)].filter(Boolean);

  if (items.length === 0) {
    return res.status(400).json({ error: 'assetid or items[] required' });
  }

  try {
    // Single load-modify-save per batch — collapses N single-item race
    // windows into one. Two truly-concurrent batches can still clobber
    // each other; the client's dismiss tombstone covers that visually.
    const state = await loadState(steamId);
    const before = state.pending.length;

    const matches = (p, item) =>
      p.assetid === item.assetid && (!item.type || p.type === item.type);

    const dismissedTradeIds = [];
    for (const item of items) {
      for (const p of state.pending) {
        if (matches(p, item) && p.tradeid) dismissedTradeIds.push(p.tradeid);
      }
    }

    const tombstones = items.map((it) =>
      it.type ? `${it.type}:${it.assetid}` : it.assetid
    );
    const dismissedAssetIds = [
      ...new Set([...(state.dismissedAssetIds || []), ...tombstones]),
    ].slice(-2000);

    const newPending = state.pending.filter(
      (p) => !items.some((it) => matches(p, it))
    );

    const next = {
      ...state,
      pending: newPending,
      processedTradeIds: [
        ...new Set([...(state.processedTradeIds || []), ...dismissedTradeIds]),
      ].slice(-2000),
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
