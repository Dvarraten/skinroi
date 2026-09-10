// POST /api/inventory/reset?confirm=yes
//
// Wipes the pending list, tombstones, and processed-trade dedup set.
// Useful when the pending list gets stuck in a weird state.
//
// Requires ?confirm=yes to avoid accidental wipes.

import { saveState, DEFAULT_STATE } from '../_lib/state.js';
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
    await saveState({ ...DEFAULT_STATE }, steamId);
    return res.status(200).json({ ok: true, reset: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
