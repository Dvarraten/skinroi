// /api/snipes
//
// GET  — current deals found across marketplaces. Rescans server-fetched
//        sources lazily (see _lib/snipes/scan.js) and returns every deal the
//        server kept; ROI, fees and liquidity filters run in the browser.
//        Requires a SkinROI session so anonymous traffic can't burn API quota.
// GET ?demo=1 — public, delayed preview for the logged-out demo: only deals
//        first seen at least 15 min ago, at most 40 (see _lib/snipes/demo.js), without
//        buy links. Never rescans, only reads Redis, and is CDN-cached.
// POST — the browser extension pushes raw CSFloat listings it fetched from
//        the user's own IP (see _lib/snipes/csfloat.js for why the server
//        can't). Authenticated via Authorization: Bearer {ext-secret}.
//        Body: { market: 'csfloat', listings: [raw /api/v1/listings rows] }
//        → { ok, checked, matched, csfloatLookups: [names] }
//        The extension then looks up the cheapest CSFloat listings of those
//        names (see _lib/snipes/csfloat-lowest.js) and pushes them back:
//        Body: { market: 'csfloat', lowest: [{ name, rows }] }
//
// Both live in one file because the Vercel Hobby plan allows 12 functions.

import { getSessionSteamId } from '../_lib/auth.js';
import { extractBearer, resolveSecret } from '../_lib/extension-store.js';
import { normalizeCsfloatListings } from '../_lib/snipes/csfloat.js';
import {
  ensureFresh, ingestCsfloatLowest, ingestListings, loadSnipes, minPriceCents,
} from '../_lib/snipes/scan.js';
import { DEMO_DELAY_MS, demoDeals } from '../_lib/snipes/demo.js';

const MAX_LISTINGS = 200;
const MAX_LOOKUPS = 10;
const MAX_LOOKUP_ROWS = 10;

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handleIngest(req, res);
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}

async function handleGet(req, res) {
  if (req.query?.demo) return handleDemo(req, res);
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

async function handleDemo(req, res) {
  try {
    const { deals, meta } = await loadSnipes();
    // One Redis read per minute at most, however many visitors there are.
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res.json({
      deals: demoDeals(deals),
      meta: meta ? { lastScan: meta.lastScan, delayedMinutes: DEMO_DELAY_MS / 60000 } : null,
      demo: true,
    });
  } catch (e) {
    console.error('[snipes] demo load failed:', e);
    return res.status(500).json({ error: 'Snipes preview unavailable' });
  }
}

async function handleIngest(req, res) {
  const steamId = await resolveSecret(extractBearer(req));
  if (!steamId) return res.status(401).json({ error: 'not paired' });

  const { market, listings, lowest } = req.body || {};
  if (market !== 'csfloat') return res.status(400).json({ error: 'unsupported market' });

  if (Array.isArray(lowest)) {
    try {
      const entries = lowest.slice(0, MAX_LOOKUPS).map((e) => ({
        name: e?.name,
        rows: Array.isArray(e?.rows) ? e.rows.slice(0, MAX_LOOKUP_ROWS) : null,
      }));
      return res.json({ ok: true, ...(await ingestCsfloatLowest(entries)) });
    } catch (e) {
      console.error('[snipes] lowest ingest failed:', e);
      return res.status(503).json({ error: e.message });
    }
  }

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
