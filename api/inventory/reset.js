// POST /api/inventory/reset?confirm=yes
//
// Wipes the saved snapshot and pending list so the next sync takes a fresh
// baseline. Use this if hasInitialSnapshot got stuck false (e.g. the very
// first sync timed out on Vercel before maxDuration was bumped) or if the
// snapshot somehow became out of sync with reality.
//
// Requires ?confirm=yes to avoid accidental wipes from random visitors. For
// a personal-tracker setup this is good enough; if you ever expose this
// publicly add an auth header check.

import { loadState, saveState, DEFAULT_STATE } from '../_lib/state.js';
import { getSessionSteamId } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if ((req.query?.confirm || req.query?.CONFIRM) !== 'yes') {
    return res.status(400).json({
      error: 'add ?confirm=yes to the URL to actually reset',
    });
  }

  const steamId = getSessionSteamId(req) || null;
  if (!steamId) {
    return res.status(401).json({ ok: false, error: 'not logged in' });
  }

  try {
    const current = await loadState(steamId);
    await saveState({
      ...DEFAULT_STATE,
      dismissedAssetIds: current.dismissedAssetIds || [],
    }, steamId);
    return res.status(200).json({ ok: true, reset: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
