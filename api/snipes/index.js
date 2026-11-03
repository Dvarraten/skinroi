// /api/snipes
//
// GET  — current deals found across marketplaces. Rescans server-fetched
//        sources lazily (see _lib/snipes/scan.js) and returns every deal the
//        server kept; ROI, fees and liquidity filters run in the browser.
//        Requires a SkinROI session so anonymous traffic can't burn API quota.
// POST — the browser extension pushes raw CSFloat listings it fetched from
//        the user's own IP (see _lib/snipes/csfloat.js for why the server
//        can't). Authenticated via Authorization: Bearer {ext-secret}.
//        Body: { market: 'csfloat', listings: [raw /api/v1/listings rows] }
//
// Both live in one file because the Vercel Hobby plan allows 12 functions.

import { getSessionSteamId } from '../_lib/auth.js';
import { extractBearer, resolveSecret } from '../_lib/extension-store.js';
import { normalizeCsfloatListings } from '../_lib/snipes/csfloat.js';
import { ensureFresh, ingestListings, loadSnipes, minPriceCents } from '../_lib/snipes/scan.js';

const MAX_LISTINGS = 200;

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handleIngest(req, res);
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}

async function handleGet(req, res) {
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

async function handleIngest(req, res) {
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
