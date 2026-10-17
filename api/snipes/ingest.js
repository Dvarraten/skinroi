// POST /api/snipes/ingest — the browser extension pushes raw CSFloat
// listings it fetched from the user's own IP (see _lib/snipes/csfloat.js for
// why the server can't fetch them). Authenticated via Authorization:
// Bearer {ext-secret}, same as /api/extension/trades.
//
// Body: { market: 'csfloat', listings: [raw /api/v1/listings rows] }

import { extractBearer, resolveSecret } from '../_lib/extension-store.js';
import { normalizeCsfloatListings } from '../_lib/snipes/csfloat.js';
import { ingestListings, minPriceCents } from '../_lib/snipes/scan.js';

const MAX_LISTINGS = 200;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const steamId = await resolveSecret(extractBearer(req));
  if (!steamId) return res.status(401).json({ error: 'not paired' });

  const { market, listings } = req.body || {};
  if (market !== 'csfloat') return res.status(400).json({ error: 'unsupported market' });
  if (!Array.isArray(listings)) return res.status(400).json({ error: 'listings must be an array' });

  try {
    const normalized = normalizeCsfloatListings(listings.slice(0, MAX_LISTINGS), {
      minPriceCents: minPriceCents(),
    });
    const result = await ingestListings('csfloat', normalized);
    return res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[snipes] ingest failed:', e);
    return res.status(503).json({ error: e.message });
  }
}
