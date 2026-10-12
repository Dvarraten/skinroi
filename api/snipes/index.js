// GET /api/snipes — current deals found across marketplaces.
//
// Rescans lazily (see _lib/snipes/scan.js) and returns every deal the server
// kept; ROI, fees and liquidity filters are applied in the browser.
// Requires a SkinROI session so anonymous traffic can't burn API quota.

import { getSessionSteamId } from '../_lib/auth.js';
import { ensureFresh, loadSnipes } from '../_lib/snipes/scan.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!getSessionSteamId(req)) return res.status(401).json({ error: 'not authenticated' });

  res.setHeader('Cache-Control', 'no-store');
  try {
    await ensureFresh();
  } catch (e) {
    // A failed scan shouldn't hide the deals we already have.
    console.error('[snipes] scan failed:', e);
  }
  try {
    return res.json(await loadSnipes());
  } catch (e) {
    console.error('[snipes] load failed:', e);
    return res.status(500).json({ error: e.message });
  }
}
