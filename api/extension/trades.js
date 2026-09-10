// POST /api/extension/trades
//
// Called by the browser extension to push accepted Steam trade offers into
// pending. Authenticated via Authorization: Bearer {ext-secret}.
//
// Body shape:
//   {
//     extVersion?: string,
//     baseline?:   boolean,       // true = seed processedTradeIds only, no pending items
//     offers: [
//       {
//         tradeofferid: string,   // Steam's canonical trade id (dedup key)
//         acceptedAt:   string,   // ISO from time_updated / time_created
//         items: [
//           {
//             type: 'incoming' | 'outgoing',
//             assetid: string,
//             marketHashName: string,
//             iconUrl?: string
//           }
//         ]
//       }
//     ]
//   }
//
// Dedupe strategy:
//   * `state.processedTradeIds` — set of tradeofferids we've already surfaced.
//     Prevents re-adding an offer's items on subsequent polls, and prevents
//     the "trade hold expiry" double-detection: the same offer id can't
//     produce two pending entries.
//   * `state.dismissedAssetIds` — per-asset tombstones for user-dismissed
//     items. Belt-and-suspenders if processedTradeIds ever gets truncated.
//
// The `baseline: true` flag is used exactly once, right after pairing: the
// backend records every historical tradeofferid but doesn't append pending
// items, so the user doesn't see hundreds of old trades on first sync.

import { loadState, saveState } from '../_lib/state.js';
import {
  extractBearer,
  resolveSecret,
  touchLastSeen,
} from '../_lib/extension-store.js';

function isTombstoned(dismissed, item) {
  const assetid = String(item.assetid);
  if (dismissed.has(`${item.type}:${assetid}`)) return true;
  if (item.type === 'incoming' && dismissed.has(assetid)) return true;
  return false;
}

function normaliseItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type === 'incoming' || raw.type === 'outgoing' ? raw.type : null;
  const assetid =
    typeof raw.assetid === 'string' || typeof raw.assetid === 'number'
      ? String(raw.assetid).trim()
      : '';
  const marketHashName = typeof raw.marketHashName === 'string' ? raw.marketHashName.trim() : '';
  if (!type || !assetid || !marketHashName) return null;
  return {
    type,
    assetid,
    marketHashName,
    iconUrl: typeof raw.iconUrl === 'string' ? raw.iconUrl : '',
  };
}

function normaliseOffer(raw, fallbackAt) {
  if (!raw || typeof raw !== 'object') return null;
  const tradeofferid =
    typeof raw.tradeofferid === 'string' || typeof raw.tradeofferid === 'number'
      ? String(raw.tradeofferid).trim()
      : '';
  if (!tradeofferid) return null;
  const acceptedAt =
    typeof raw.acceptedAt === 'string' && raw.acceptedAt ? raw.acceptedAt : fallbackAt;
  const items = Array.isArray(raw.items)
    ? raw.items.map(normaliseItem).filter(Boolean)
    : [];
  return { tradeofferid, acceptedAt, items };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const secret = extractBearer(req);
  if (!secret) return res.status(401).json({ error: 'missing Bearer token' });

  const steamId = await resolveSecret(secret);
  if (!steamId) return res.status(401).json({ error: 'invalid secret' });

  const body =
    req.body && typeof req.body === 'object'
      ? req.body
      : (() => {
          try {
            return JSON.parse(req.body || '{}');
          } catch {
            return {};
          }
        })();

  const startedAt = new Date().toISOString();
  const baseline = body.baseline === true;
  const extVersion = typeof body.extVersion === 'string' ? body.extVersion.slice(0, 32) : null;
  const rawOffers = Array.isArray(body.offers) ? body.offers : [];
  const offers = rawOffers.map((o) => normaliseOffer(o, startedAt)).filter(Boolean);

  try {
    const state = await loadState(steamId);
    const processed = new Set(state.processedTradeIds || []);
    const dismissed = new Set(state.dismissedAssetIds || []);
    const seenPending = new Set(state.pending.map((p) => `${p.type}:${p.assetid}`));

    const append = [];
    const newOfferIds = [];

    for (const offer of offers) {
      if (processed.has(offer.tradeofferid)) continue;
      newOfferIds.push(offer.tradeofferid);
      if (baseline) continue; // seed only — no pending entries
      for (const item of offer.items) {
        if (isTombstoned(dismissed, item)) continue;
        const key = `${item.type}:${item.assetid}`;
        if (seenPending.has(key)) continue;
        append.push({
          ...item,
          tradeid: offer.tradeofferid,
          detectedAt: offer.acceptedAt,
        });
        seenPending.add(key);
      }
    }

    // Cap the processed set. 2000 entries is a decade+ of trades for a heavy
    // trader; older entries falling off is fine because the extension only
    // seeds each historical offer once and the tombstones catch dismissed
    // items even if their tradeofferid rolls out of the set.
    const nextProcessed = newOfferIds.length
      ? [...new Set([...(state.processedTradeIds || []), ...newOfferIds])].slice(-2000)
      : state.processedTradeIds || [];

    const next = {
      ...state,
      pending: state.pending.concat(append),
      processedTradeIds: nextProcessed,
      lastSync: startedAt,
      lastSyncOk: true,
      lastError: null,
    };
    await saveState(next, steamId);
    await touchLastSeen(steamId, extVersion);

    return res.status(200).json({
      ok: true,
      baseline,
      accepted: append.length,
      seededOffers: baseline ? newOfferIds.length : 0,
      pending: next.pending,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
