// Extension pairing lifecycle for the logged-in SkinROI user.
//
// GET    /api/extension/pair              → { connected, pending }
// GET    /api/extension/pair?code=XXX-YYY → poll status of a specific code
// POST   /api/extension/pair              → generate a new pairing code
// DELETE /api/extension/pair              → revoke the current extension link
//
// All operations are authenticated by the cs2-session cookie — the extension
// itself uses /api/extension/claim (public, code-authenticated) to swap the
// code for a long-lived secret.

import { getSessionSteamId } from '../_lib/auth.js';
import {
  generatePairingCode,
  savePairing,
  loadPairing,
  loadExtensionInfo,
  revokeExtension,
} from '../_lib/extension-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const steamId = getSessionSteamId(req);
  if (!steamId) return res.status(401).json({ error: 'not logged in' });

  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const code = typeof req.query?.code === 'string' ? req.query.code : null;
      const info = await loadExtensionInfo(steamId);
      const connected = info
        ? {
            extVersion: info.extVersion,
            pairedAt: info.pairedAt,
            lastSeen: info.lastSeen,
          }
        : null;

      if (code) {
        const pairing = await loadPairing(code);
        // Only surface pairing state to the user who created it.
        const owned = pairing && pairing.steamId === steamId;
        return res.status(200).json({
          connected,
          pending: owned
            ? {
                code,
                claimed: !!pairing.claimed,
                extVersion: pairing.extVersion || null,
              }
            : null,
        });
      }

      return res.status(200).json({ connected, pending: null });
    }

    if (req.method === 'POST') {
      // One-shot code generation. Any previous code for this user simply
      // expires on its own (10-min TTL) — we don't track them.
      const code = generatePairingCode();
      const { expiresAt } = await savePairing(code, steamId);
      return res.status(200).json({ code, expiresAt });
    }

    if (req.method === 'DELETE') {
      const result = await revokeExtension(steamId);
      return res.status(200).json({ ok: true, ...result });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
