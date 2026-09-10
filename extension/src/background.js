// Background service worker. Runs on a chrome.alarms schedule and reacts to
// popup "Sync now" messages. Every tick, it pulls the user's accepted trade
// offers from Steam's IEconService and pushes them to the SkinROI backend.
//
// The backend dedupes by tradeofferid, so trades never surface twice — no
// more "item reappears when its 7-day hold expires" bug.

import { POLL_INTERVAL_MIN } from './lib/config.js';
import {
  getPairing,
  pushActivity,
  getDescCache,
  saveDescCache,
  getInspectCache,
  saveInspectCache,
  getHasSeededOffers,
  setHasSeededOffers,
} from './lib/storage.js';
import {
  getSteamIdFromCookie,
  fetchSessionAccessToken,
  fetchAcceptedTradeOffers,
  fetchInventoryDescriptions,
  normalizeAcceptedOffers,
  collectAllAcceptedTradeIds,
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

// Wrap chrome.storage / fetch mistakes so no error is silently swallowed —
// something ALWAYS ends up in the activity log, or in the SW console.
async function safeLogError(msg) {
  console.error('[skinroi]', msg);
  try {
    await pushActivity({ kind: 'error', message: String(msg).slice(0, 200) });
  } catch (e) {
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
    const { secret, steamId: pairedSteamId, pairedAt } = await getPairing();
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

    let raw;
    try {
      raw = await fetchAcceptedTradeOffers(token);
    } catch (err) {
      await safeLogError(`GetTradeOffers: ${err.message || err}`);
      return { skipped: 'fetch_failed' };
    }

    const acceptedRaw = raw.offers.filter((o) => Number(o.trade_offer_state) === 3);
    console.log(
      '[skinroi] poll',
      manual ? '(manual)' : '(alarm)',
      'raw:', raw.offers.length,
      'accepted:', acceptedRaw.length,
      'pairedAt:', pairedAt ? new Date(pairedAt).toISOString() : 'null'
    );

    // Merge descriptions from three sources into raw.descByKey:
    //   1. Steam's offer response (usually only a handful)
    //   2. User's live inventory (ctx 2 + ctx 16)
    //   3. Persistent cache in chrome.storage.local from prior syncs
    // Then save the union back to cache so outgoing trades (items that just
    // left our inventory) still have descs on subsequent syncs.
    try {
      const cached = await getDescCache();
      for (const [k, v] of Object.entries(cached)) {
        if (!raw.descByKey.has(k)) raw.descByKey.set(k, v);
      }
    } catch (err) {
      console.warn('[skinroi] desc cache load failed', err?.message || err);
    }
    try {
      const invDesc = await fetchInventoryDescriptions(cookieSteamId);
      for (const [k, v] of invDesc) {
        if (!raw.descByKey.has(k)) raw.descByKey.set(k, v);
      }
    } catch (err) {
      console.warn('[skinroi] inventory desc lookup failed', err?.message || err);
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
      console.warn('[skinroi] desc cache save failed', err?.message || err);
    }

    const hasSeeded = await getHasSeededOffers();

    // First sync after pairing: seed all pre-existing tradeofferids into
    // processedTradeIds silently, and only surface trades whose `time_updated`
    // is on-or-after `pairedAt` (with 60s grace) — those are the ones the
    // user actually completed right around when they paired. Everything
    // else is historical and gets marked processed so bumped time_updated
    // on old trades (7-day hold expiries) can't resurface them.
    if (!hasSeeded) {
      const pairGraceMs = 60 * 1000;
      const pairThresholdSec = pairedAt
        ? Math.floor((pairedAt - pairGraceMs) / 1000)
        : 0;
      const recentRawOffers = acceptedRaw.filter(
        (o) =>
          !pairThresholdSec || Number(o.time_updated) >= pairThresholdSec
      );
      const historicalRawOffers = acceptedRaw.filter(
        (o) => !recentRawOffers.includes(o)
      );
      console.log(
        '[skinroi] baseline: seeding', historicalRawOffers.length,
        'historical + surfacing', recentRawOffers.length, 'recent'
      );

      // Historical: send as baseline (tradeofferids only, no items needed).
      if (historicalRawOffers.length > 0) {
        const seeds = collectAllAcceptedTradeIds(historicalRawOffers);
        try {
          await pushOffers({ offers: seeds, baseline: true });
        } catch (err) {
          await safeLogError(`Baseline seed: ${err.message || err}`);
          return { skipped: 'baseline_failed' };
        }
      }

      // Recent: fully normalize and push as regular trades so they end up
      // in Handle Items. Same enrichment path as subsequent polls.
      const recentOffers = normalizeAcceptedOffers(recentRawOffers, raw.descByKey);
      if (recentOffers.length > 0) {
        try {
          const inspectCache = await getInspectCache();
          await enrichOffersWithInspect({
            offers: recentOffers,
            descByKey: raw.descByKey,
            ownerSteamId: cookieSteamId,
            cache: inspectCache,
          });
          await saveInspectCache(inspectCache);
        } catch (err) {
          console.warn('[skinroi] inspect enrichment failed', err?.message || err);
        }
        try {
          const r = await pushOffers({ offers: recentOffers, baseline: false });
          if ((r.accepted || 0) > 0) {
            await pushActivity({
              kind: 'push',
              accepted: r.accepted,
              total: recentOffers.length,
            });
          }
        } catch (err) {
          await safeLogError(`Recent push: ${err.message || err}`);
          return { skipped: 'push_failed' };
        }
      }

      await setHasSeededOffers(true);
      await pushActivity({
        kind: 'baseline',
        message:
          `Seeded ${historicalRawOffers.length} historical trade${
            historicalRawOffers.length === 1 ? '' : 's'
          }` +
          (recentOffers.length > 0
            ? ` + surfaced ${recentOffers.length} recent`
            : ''),
      });
      return {
        baseline: true,
        seeded: historicalRawOffers.length,
        recent: recentOffers.length,
      };
    }

    // Post-baseline: push every accepted offer we can normalize. Backend
    // dedupes by tradeofferid, so already-seeded offers are skipped and
    // only truly-new trades produce pending rows.
    const offers = normalizeAcceptedOffers(raw.offers, raw.descByKey);
    console.log(
      '[skinroi] normalized offers:', offers.length,
      'descs:', raw.descByKey.size
    );

    // Enrich each item with float, paint seed, stickers, keychains via
    // CSFloat's inspect API. Cached per-assetid in chrome.storage.local
    // — a specific asset's inspect data never changes, so a hit skips
    // the network call entirely.
    if (offers.length > 0) {
      try {
        const inspectCache = await getInspectCache();
        await enrichOffersWithInspect({
          offers,
          descByKey: raw.descByKey,
          ownerSteamId: cookieSteamId,
          cache: inspectCache,
        });
        await saveInspectCache(inspectCache);
      } catch (err) {
        console.warn('[skinroi] inspect enrichment failed', err?.message || err);
      }
    }

    let result;
    try {
      result = await pushOffers({ offers, baseline: false });
    } catch (err) {
      await safeLogError(`Push: ${err.message || err}`);
      return { skipped: 'push_failed' };
    }

    const accepted = result.accepted || 0;
    if (accepted > 0) {
      await pushActivity({ kind: 'push', accepted, total: offers.length });
    } else if (manual) {
      // No new trades — but the user manually asked, so surface a confirmation.
      await pushActivity({ kind: 'info', message: 'No new trades detected' });
    }
    return { pushed: offers.length, ...result };
  } catch (err) {
    await safeLogError(`Unexpected: ${err.message || err}`);
    return { skipped: 'unexpected', error: String(err) };
  } finally {
    pollInFlight = false;
  }
}
