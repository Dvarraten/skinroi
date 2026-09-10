// POST /api/extension/claim   body: { code: string, extVersion?: string }
//
// Called by the extension after the user pastes their pairing code. The code
// is the sole authentication — it's short-lived (10 min), single-use, and
// pre-authorised by the logged-in SkinROI user who generated it. On success
// we return { secret, steamId }; the extension stores the secret in
// chrome.storage.local and uses it as a Bearer token for /api/extension/trades.

import { claimPairing } from '../_lib/extension-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body =
    req.body && typeof req.body === 'object'
      ? req.body
      : (() => { try { return JSON.parse(req.body || '{}'); } catch { return {}; } })();

  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : null;
  const extVersion = typeof body.extVersion === 'string' ? body.extVersion.slice(0, 32) : null;

  if (!code) return res.status(400).json({ error: 'code required' });

  try {
    const result = await claimPairing(code, extVersion);
    if (!result.ok) {
      const status = result.reason === 'already_claimed' ? 409 : 400;
      return res.status(status).json({ error: result.reason });
    }
    return res.status(200).json({
      ok: true,
      secret: result.secret,
      steamId: result.steamId,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
