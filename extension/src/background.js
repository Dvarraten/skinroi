// Background service worker. Runs on a chrome.alarms schedule and reacts to
// popup "Sync now" messages. Every tick it pulls the user's accepted trade
// offers from Steam via both IEconService/GetTradeOffers and
// IEconService/GetTradeHistory, merges them by tradeofferid, and pushes the
// union to the SkinROI backend.
//
// The backend handles the pairedAt cutoff: trades accepted before pairing are
// silently recorded in processedTradeIds without surfacing in Handle Items.
// Trades accepted on or after pairing go straight to pending. No baseline seed
// or first-sync special-casing is needed on the extension side.

import { POLL_INTERVAL_MIN } from './lib/config.js';
import {
  getPairing,
  pushActivity,
  getDescCache,
  saveDescCache,
  getInspectCache,
  saveInspectCache,
  getVerboseLogging,
} from './lib/storage.js';
import {
  getSteamIdFromCookie,
  fetchSessionAccessToken,
  fetchAcceptedTradeOffers,
  fetchInventoryDescriptions,
  fetchTradeHistory,
  normalizeAcceptedOffers,
  normalizeTradeHistoryOffers,
  collectMissingClassIds,
  resolveUnknownClassIds,
  collectTradeIdsMissingDescriptions,
  resolveDescriptionsViaTradeStatus,
} from './lib/steam.js';
import { enrichOffersWithInspect } from './lib/inspect.js';
import { pushOffers } from './lib/skinroi.js';

const ALARM_NAME = 'skinroi-poll';

// Prevent overlapping polls if one runs long. Alarms can fire again while a
// previous invocation is still awaiting fetch responses.
let pollInFlight = false;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.5,
    periodInMinutes: POLL_INTERVAL_MIN,
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.5,
    periodInMinutes: POLL_INTERVAL_MIN,
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runPoll({ manual: false }).catch((err) => console.error('[skinroi] poll failed', err));
  }
});

// Popup → background: "Sync now" button. Always signal completion so the
// popup can re-render its activity list even if we log nothing.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'runPollNow') {
    runPoll({ manual: true }).then(
      (result) => sendResponse({ ok: true, result }),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true; // async response
  }
  return false;
});

// Route expected/handled errors through the popup activity log only.
// Deliberately no console.error — that lights up chrome://extensions/?errors
// with red badges for every transient Steam blip, which is scary noise for
// something we already retry and recover from. Reserve console.error for
// genuine unhandled bugs (below).
async function safeLogError(msg) {
  try {
    await pushActivity({ kind: 'error', message: String(msg).slice(0, 200) });
  } catch (e) {
    // pushActivity itself failing IS a real bug — chrome.storage.local
    // being broken means the extension can't do its job.
    console.error('[skinroi] pushActivity failed', e);
  }
}

async function runPoll({ manual = false } = {}) {
  if (pollInFlight) {
    if (manual) await pushActivity({ kind: 'info', message: 'Poll already running' });
    return { skipped: 'in_flight' };
  }
  pollInFlight = true;
  try {
    const verbose = await getVerboseLogging();
    const dbg = verbose ? (...a) => console.log(...a) : () => {};

    const { secret, steamId: pairedSteamId } = await getPairing();
    if (!secret) {
      if (manual) await safeLogError('Extension is not paired — enter a code first.');
      return { skipped: 'not_paired' };
    }

    const cookieSteamId = await getSteamIdFromCookie();
    if (!cookieSteamId) {
      await safeLogError('Not signed in to Steam');
      return { skipped: 'not_logged_in_to_steam' };
    }
    if (pairedSteamId && cookieSteamId !== pairedSteamId) {
      await safeLogError(`Steam ID mismatch (${cookieSteamId} vs paired ${pairedSteamId})`);
      return { skipped: 'steam_id_mismatch', cookieSteamId, pairedSteamId };
    }

    let token;
    try {
      token = await fetchSessionAccessToken();
    } catch (err) {
      await safeLogError(`Token: ${err.message || err}`);
      return { skipped: 'no_token' };
    }

    // ── GetTradeOffers ────────────────────────────────────────────────────────
    let raw;
    try {
      raw = await fetchAcceptedTradeOffers(token);
    } catch (err) {
      await safeLogError(`GetTradeOffers: ${err.message || err}`);
      return { skipped: 'fetch_failed' };
    }

    const acceptedCount = raw.offers.filter((o) => Number(o.trade_offer_state) === 3).length;
    dbg(
      '[skinroi] poll', manual ? '(manual)' : '(alarm)',
      'raw:', raw.offers.length, 'accepted:', acceptedCount
    );

    // ── Description cache: merge from offer response + persistent cache + inventory ──
    try {
      const cached = await getDescCache();
      for (const [k, v] of Object.entries(cached)) {
        if (!raw.descByKey.has(k)) raw.descByKey.set(k, v);
      }
    } catch (err) {
      console.debug('[skinroi] desc cache load failed', err?.message || err);
    }
    try {
      const invDesc = await fetchInventoryDescriptions(cookieSteamId);
      for (const [k, v] of invDesc) {
        if (!raw.descByKey.has(k)) raw.descByKey.set(k, v);
      }
    } catch (err) {
      console.debug('[skinroi] inventory desc lookup failed', err?.message || err);
    }

    // ── GetTradeHistory ───────────────────────────────────────────────────────
    // Paginates up to 50 pages × 500 trades = 25 000 trades. Results are merged
    // with GetTradeOffers by tradeofferid; GetTradeOffers data takes precedence
    // because it carries time_updated (actual accepted time), whereas
    // GetTradeHistory only has time_init (when the trade was created). Trades
    // only present in history still benefit from new_assetid (the correct
    // assetid for inspect links on received items). A failure here is non-fatal:
    // GetTradeOffers already covers the post-pairing window.
    let historyTrades = [];
    let historyDescByKey = new Map();
    try {
      const histResult = await fetchTradeHistory(token);
      historyTrades = histResult.trades;
      historyDescByKey = histResult.descByKey;
      dbg('[skinroi] history pages fetched, trades:', historyTrades.length, 'descs:', histResult.descByKey.size);
    } catch (err) {
      dbg('[skinroi] GetTradeHistory FAILED:', err?.message || err);
      console.debug('[skinroi] GetTradeHistory failed (non-fatal):', err?.message || err);
    }

    // Merge history descriptions before normalizing so all items can be named.
    for (const [k, v] of historyDescByKey) {
      if (!raw.descByKey.has(k)) raw.descByKey.set(k, v);
    }

    // ── GetTradeStatus: descriptions for buy-order / settlement-delayed trades ─
    // Offers with `delay_settlement: true` (e.g. CSFloat auto-accept) carry
    // `missing: true` on items and no descriptions. GetTradeStatus with the
    // offer's `tradeid` returns descriptions including market_hash_name, so we
    // resolve them here before persisting and normalizing.
    try {
      const missingTradeids = collectTradeIdsMissingDescriptions(raw.offers, raw.descByKey);
      if (missingTradeids.length > 0) {
        const added = await resolveDescriptionsViaTradeStatus(token, missingTradeids, raw.descByKey);
        dbg('[skinroi] GetTradeStatus added', added, 'descriptions for', missingTradeids.length, 'trade(s)');
      }
    } catch (err) {
      console.debug('[skinroi] GetTradeStatus fallback failed:', err?.message || err);
    }

    // Persist the union so future syncs can name outgoing items.
    try {
      const flat = {};
      for (const [k, v] of raw.descByKey) {
        flat[k] = {
          market_hash_name: v.market_hash_name,
          name: v.name,
          icon_url: v.icon_url,
          classid: v.classid,
          instanceid: v.instanceid,
        };
      }
      await saveDescCache(flat);
    } catch (err) {
      console.debug('[skinroi] desc cache save failed', err?.message || err);
    }

    // ── Fallback: GetAssetClassInfo for items with no description ─────────────
    // Some outgoing items (e.g. sold via YouPin) leave the user's inventory
    // before the poll runs, and Steam omits their descriptions from the offer
    // response. GetAssetClassInfo is a public endpoint that returns descriptions
    // by classid and doesn't require the item to be in any particular inventory.
    try {
      const missing = collectMissingClassIds(raw.offers, raw.descByKey);
      if (missing.length > 0) {
        const beforeSize = raw.descByKey.size;
        dbg('[skinroi] resolving', missing.length, 'missing classid(s) via GetAssetClassInfo');
        await resolveUnknownClassIds(missing, raw.descByKey);
        dbg('[skinroi] GetAssetClassInfo added', raw.descByKey.size - beforeSize, 'descriptions');
      }
    } catch (err) {
      console.debug('[skinroi] GetAssetClassInfo fallback failed:', err?.message || err);
    }

    // ── Normalize + merge ─────────────────────────────────────────────────────
    const offersNormalized = normalizeAcceptedOffers(raw.offers, raw.descByKey);
    const historyNormalized = normalizeTradeHistoryOffers(historyTrades, raw.descByKey);

    // GetTradeHistory's tradeid is NOT the same as an offer's tradeofferid — it
    // corresponds to the `tradeid` field on the offer. Dedup by that field so the
    // same trade doesn't appear twice (once from GetTradeOffers and once from
    // GetTradeHistory). GetTradeOffers data takes precedence (carries time_updated
    // as acceptedAt; history only has time_init).
    const offerTradeIds = new Set(
      raw.offers
        .map((o) => (o.tradeid != null ? String(o.tradeid) : ''))
        .filter(Boolean)
    );
    const allOffers = [
      ...offersNormalized,
      ...historyNormalized.filter((h) => !offerTradeIds.has(h.tradeid)),
    ];

    dbg(
      '[skinroi] merged offers:', allOffers.length,
      '(offers:', offersNormalized.length,
      'history:', historyNormalized.length,
      'descs:', raw.descByKey.size, ')'
    );
    if (acceptedCount > offersNormalized.length) {
      const droppedOffers = raw.offers.filter(
        (o) => Number(o.trade_offer_state) === 3 &&
          !offersNormalized.some((n) => n.tradeofferid === String(o.tradeofferid))
      );
      // Separate "no CS2 items at all" (correct) from "CS2 items with missing desc" (bug).
      const noCS2 = droppedOffers.filter((o) => {
        const items = [...(o.items_to_receive || []), ...(o.items_to_give || [])];
        return !items.some((it) => it.appid == null || String(it.appid) === '730');
      });
      const missingDesc = droppedOffers.length - noCS2.length;
      dbg(
        '[skinroi] dropped:', droppedOffers.length,
        '— non-CS2 offers (correct):', noCS2.length,
        '— CS2 offers with missing descriptions (bug):', missingDesc
      );
      if (missingDesc > 0) {
        dbg('[skinroi] CS2 offers with missing desc, ids:',
          droppedOffers.filter((o) => {
            const items = [...(o.items_to_receive || []), ...(o.items_to_give || [])];
            return items.some((it) => it.appid == null || String(it.appid) === '730');
          }).map((o) => String(o.tradeofferid))
        );
      }
    }

    // ── CSFloat inspect enrichment ────────────────────────────────────────────
    if (allOffers.length > 0) {
      try {
        const inspectCache = await getInspectCache();
        await enrichOffersWithInspect({
          offers: allOffers,
          descByKey: raw.descByKey,
          ownerSteamId: cookieSteamId,
          cache: inspectCache,
        });
        await saveInspectCache(inspectCache);
      } catch (err) {
        console.debug('[skinroi] inspect enrichment failed', err?.message || err);
      }
    }

    // ── Push to backend ───────────────────────────────────────────────────────
    let result;
    try {
      result = await pushOffers({ offers: allOffers });
    } catch (err) {
      await safeLogError(`Push: ${err.message || err}`);
      return { skipped: 'push_failed' };
    }

    const accepted = result.accepted || 0;
    const historical = result.historical || 0;
    dbg('[skinroi] backend: accepted:', accepted, 'historical:', historical);
    if (accepted > 0) {
      await pushActivity({ kind: 'push', accepted, total: allOffers.length, items: result.newItems || [] });
    } else if (historical > 0) {
      await pushActivity({
        kind: 'info',
        message: `Recorded ${historical} historical trade${historical === 1 ? '' : 's'} (before pairing — not added to Handle Items)`,
      });
    } else if (manual) {
      await pushActivity({ kind: 'info', message: 'No new trades detected' });
    }
    return { pushed: allOffers.length, ...result };
  } catch (err) {
    await safeLogError(`Unexpected: ${err.message || err}`);
    return { skipped: 'unexpected', error: String(err) };
  } finally {
    pollInFlight = false;
  }
}
