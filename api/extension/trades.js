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

function normaliseStickerList(raw, isKeychain = false) {
  if (!Array.isArray(raw)) return undefined;
  const out = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const stickerId = Number(s.stickerId ?? s.sticker_id);
    if (!Number.isFinite(stickerId)) continue;
    const entry = {
      stickerId,
      slot: Number.isFinite(Number(s.slot)) ? Number(s.slot) : null,
    };
    if (typeof s.name === 'string') entry.name = s.name;
    if (typeof s.wear === 'number' && Number.isFinite(s.wear)) entry.wear = s.wear;
    if (isKeychain && Number.isFinite(Number(s.pattern))) entry.pattern = Number(s.pattern);
    out.push(entry);
  }
  return out.length > 0 ? out : undefined;
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

  const item = {
    type,
    assetid,
    marketHashName,
    iconUrl: typeof raw.iconUrl === 'string' ? raw.iconUrl : '',
  };

  // Optional inspect-derived fields. Kept off the item unless the extension
  // actually resolved them, so pending entries stay compact for items the
  // inspect API couldn't handle (agents, capsules, keys, etc.).
  if (typeof raw.floatValue === 'number' && Number.isFinite(raw.floatValue)) {
    item.floatValue = raw.floatValue;
  }
  if (typeof raw.paintSeed === 'number' && Number.isFinite(raw.paintSeed)) {
    item.paintSeed = raw.paintSeed;
  }
  if (typeof raw.paintIndex === 'number' && Number.isFinite(raw.paintIndex)) {
    item.paintIndex = raw.paintIndex;
  }
  if (typeof raw.defIndex === 'number' && Number.isFinite(raw.defIndex)) {
    item.defIndex = raw.defIndex;
  }
  const stickers = normaliseStickerList(raw.stickers, false);
  if (stickers) item.stickers = stickers;
  const keychains = normaliseStickerList(raw.keychains, true);
  if (keychains) item.keychains = keychains;

  return item;
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
    // Reconcile map: type:assetid → freshest item payload from this push.
    // Lets us upgrade existing pending items when the extension eventually
    // resolves a name / float / stickers that weren't available at first
    // detection (common for Souvenir skins whose descriptions take a beat
    // to propagate to the inventory endpoint after a trade completes).
    const reconcileMap = new Map();
    for (const offer of offers) {
      for (const item of offer.items) {
        reconcileMap.set(`${item.type}:${item.assetid}`, {
          ...item,
          tradeid: offer.tradeofferid,
          detectedAt: offer.acceptedAt,
        });
      }
    }

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

    // For pending items that already exist, patch fields that were missing
    // or that Steam has since surfaced. Never regresses a good name to
    // Unknown — a fresh payload with an "Unknown CS2 Item" fallback is
    // treated as no update.
    // Clean up any legacy "Unknown CS2 Item (classid)" placeholders that
    // an earlier build wrote before we started dropping unnamed items at
    // push time. Only removes ones that AREN'T being rescued by a fresh
    // named push in this batch — those get patched by the reconcile below.
    const isUnknown = (p) =>
      typeof p.marketHashName === 'string' &&
      p.marketHashName.startsWith('Unknown CS2 Item');
    const cleanedPending = state.pending.filter((p) => {
      if (!isUnknown(p)) return true;
      const fresh = reconcileMap.get(`${p.type}:${p.assetid}`);
      const rescuable =
        fresh &&
        typeof fresh.marketHashName === 'string' &&
        !fresh.marketHashName.startsWith('Unknown CS2 Item');
      return rescuable;
    });

    const patchedPending = cleanedPending.map((p) => {
      const fresh = reconcileMap.get(`${p.type}:${p.assetid}`);
      if (!fresh) return p;
      const merged = { ...p };
      let changed = false;
      const isBetterName =
        typeof fresh.marketHashName === 'string' &&
        !fresh.marketHashName.startsWith('Unknown CS2 Item') &&
        (typeof p.marketHashName !== 'string' ||
          p.marketHashName.startsWith('Unknown CS2 Item'));
      if (isBetterName) {
        merged.marketHashName = fresh.marketHashName;
        changed = true;
      }
      if (!p.iconUrl && fresh.iconUrl) {
        merged.iconUrl = fresh.iconUrl;
        changed = true;
      }
      for (const k of ['floatValue', 'paintSeed', 'paintIndex', 'defIndex']) {
        if (p[k] == null && fresh[k] != null) {
          merged[k] = fresh[k];
          changed = true;
        }
      }
      for (const k of ['stickers', 'keychains']) {
        if ((!Array.isArray(p[k]) || p[k].length === 0) && Array.isArray(fresh[k]) && fresh[k].length > 0) {
          merged[k] = fresh[k];
          changed = true;
        }
      }
      return changed ? merged : p;
    });

    // Cap the processed set. 5000 entries comfortably covers a heavy trader
    // for years; the baseline seed on first pair fills this with every
    // historical tradeofferid, so trade-hold-expiry bumps on old trades
    // can never resurface them via the extension.
    const nextProcessed = newOfferIds.length
      ? [...new Set([...(state.processedTradeIds || []), ...newOfferIds])].slice(-5000)
      : state.processedTradeIds || [];

    const next = {
      ...state,
      pending: patchedPending.concat(append),
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
