// POST /api/extension/trades
//
// Called by the browser extension to push accepted Steam trade offers into
// pending. Authenticated via Authorization: Bearer {ext-secret}.
//
// Body shape:
//   {
//     extVersion?: string,
//     offers: [
//       {
//         tradeofferid: string,   // Steam's canonical trade id (dedup key)
//         acceptedAt:   string,   // ISO from GetTradeOffers time_updated (or time_init
//                                 // for history-only trades). Used to determine whether
//                                 // the trade is new (>= pairedAt) or historical.
//         items: [
//           {
//             type: 'incoming' | 'outgoing',
//             assetid: string,
//             marketHashName: string,
//             iconUrl?: string,
//             floatValue?: number,
//             paintSeed?: number,
//             paintIndex?: number,
//             defIndex?: number,
//             stickers?: [...],
//             keychains?: [...]
//           }
//         ]
//       }
//     ]
//   }
//
// Dedup + surface strategy:
//   The extension sends ALL accepted trades on every poll — both recent and
//   historical — with no client-side time filter. The backend decides what to
//   surface in Handle Items using the user's pairedAt timestamp (stored when
//   the extension first claimed its pairing code):
//
//   • tradeofferid already in processedTradeIds
//       → reconcile only (patch missing float/stickers on existing pending items)
//
//   • tradeofferid NOT in processedTradeIds, acceptedAt >= pairedAt - 60s
//       → add to processedTradeIds + add items to pending (new trade!)
//
//   • tradeofferid NOT in processedTradeIds, acceptedAt < pairedAt - 60s
//       → add to processedTradeIds only (historical trade, don't flood Handle Items)
//
//   This means on the very first poll after pairing, all historical trades are
//   silently recorded in processedTradeIds without appearing in Handle Items.
//   No baseline seed or hasSeeded flag is needed on the extension side.
//   Re-installing the extension triggers the same flow automatically.
//
//   Hold-expiry false positives are prevented by the processedTradeIds dedup:
//   when Steam bumps time_updated on a 7-day-hold expiry, the tradeofferid is
//   already in processedTradeIds from the first time we saw it (when its
//   time_updated was still before pairedAt), so it hits the reconcile-only path.

import { loadState, saveState } from '../_lib/state.js';
import {
  extractBearer,
  resolveSecret,
  loadExtensionInfo,
  touchLastSeen,
} from '../_lib/extension-store.js';

// 60-second grace window before pairedAt so trades completed right before
// pairing are still surfaced (covers the common case of pairing immediately
// after completing a trade).
const PAIR_GRACE_MS = 60_000;

// Upper bound on how many tradeofferids we keep in processedTradeIds.
// 50 000 comfortably covers a very active trader for many years. Entries are
// kept as a LIFO ring — we drop the oldest when the cap is hit, which is
// safe because old trades that fall off have been in pending long enough to
// have been handled (or dismissed and tombstoned in dismissedAssetIds).
const PROCESSED_TRADE_IDS_CAP = 50_000;

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
  const extVersion = typeof body.extVersion === 'string' ? body.extVersion.slice(0, 32) : null;
  const rawOffers = Array.isArray(body.offers) ? body.offers : [];
  const offers = rawOffers.map((o) => normaliseOffer(o, startedAt)).filter(Boolean);

  try {
    // Load pairedAt from ext-info. Used as the cutoff: trades accepted before
    // this timestamp are recorded in processedTradeIds but not surfaced in
    // pending. A missing pairedAt (should never happen in production) means we
    // treat everything as new — safe default, the user just sees all trades.
    const extInfo = await loadExtensionInfo(steamId);
    const pairedAt = extInfo?.pairedAt ?? 0;
    const pairThresholdMs = pairedAt > 0 ? pairedAt - PAIR_GRACE_MS : 0;

    const state = await loadState(steamId);
    const processed = new Set(state.processedTradeIds || []);
    const dismissed = new Set(state.dismissedAssetIds || []);
    const seenPending = new Set(state.pending.map((p) => `${p.type}:${p.assetid}`));

    const append = [];
    const newOfferIds = [];

    // Reconcile map: type:assetid → freshest item payload from this push.
    // Used below to upgrade existing pending items when the extension resolves
    // a float / stickers that weren't available at first detection.
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
      if (processed.has(offer.tradeofferid)) {
        // Already seen — reconcile only (handled below via patchedPending).
        continue;
      }

      newOfferIds.push(offer.tradeofferid);

      // Determine whether this trade is new (surface in Handle Items) or
      // historical (record in processedTradeIds to prevent future re-surfacing,
      // but don't add items to pending).
      const acceptedMs = offer.acceptedAt ? new Date(offer.acceptedAt).getTime() : 0;
      const isNew = !pairThresholdMs || acceptedMs >= pairThresholdMs;
      if (!isNew) continue;

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

    // Remove any legacy "Unknown CS2 Item (classid)" placeholders written by
    // older extension builds before we started dropping unnamed items at push
    // time. Only keeps unknowns that are about to be rescued by a fresh named
    // payload in this batch.
    const isUnknown = (p) =>
      typeof p.marketHashName === 'string' &&
      p.marketHashName.startsWith('Unknown CS2 Item');
    const cleanedPending = state.pending.filter((p) => {
      if (!isUnknown(p)) return true;
      const fresh = reconcileMap.get(`${p.type}:${p.assetid}`);
      return (
        fresh &&
        typeof fresh.marketHashName === 'string' &&
        !fresh.marketHashName.startsWith('Unknown CS2 Item')
      );
    });

    // Patch existing pending items with enriched fields that weren't available
    // when the item was first detected (float, stickers, better name, icon).
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
        if (
          (!Array.isArray(p[k]) || p[k].length === 0) &&
          Array.isArray(fresh[k]) &&
          fresh[k].length > 0
        ) {
          merged[k] = fresh[k];
          changed = true;
        }
      }
      return changed ? merged : p;
    });

    const nextProcessed = newOfferIds.length
      ? [...new Set([...(state.processedTradeIds || []), ...newOfferIds])].slice(
          -PROCESSED_TRADE_IDS_CAP
        )
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
      accepted: append.length,
      pending: next.pending,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
