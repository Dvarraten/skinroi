// Core sync logic — compares the latest Steam trade history and inventory
// snapshot against saved state to detect incoming and outgoing CS2 items.
//
// runSync() is called by POST /api/inventory/sync (user-triggered).
// It serialises concurrent calls via a soft Redis lock (syncLockAt) and
// reloads fresh state immediately before every saveState call to avoid
// clobbering concurrent dismiss writes. dismissedAssetIds tombstones prevent
// a dismissed item from being written back by a sync that started earlier.
import { loadState, saveState, DEFAULT_STATE } from './state.js';
import {
  fetchTradeHistory,
  fetchInventory,
  buildSnapshotFromInventory,
  fetchAssetClassInfo,
} from './steam.js';
import { getAccessToken } from './steam-session.js';

export const POLL_INTERVAL_MIN = 5;
export const STALE_THRESHOLD_MS = POLL_INTERVAL_MIN * 60 * 1000;
const LOCK_TTL_MS = 90 * 1000;

export function isStateStale(state) {
  if (!state.lastSync) return true;
  return Date.now() - new Date(state.lastSync).getTime() > STALE_THRESHOLD_MS;
}

// Returns true if a pending item should be blocked by the tombstone set.
// Typed tombstones ("incoming:assetid") only block their own type.
// Legacy untyped tombstones only block incoming items, never outgoing.
function isTombstoned(dismissed, p) {
  const assetid = String(p.assetid);
  if (dismissed.has(`${p.type}:${assetid}`)) return true;
  if (p.type === 'incoming' && dismissed.has(assetid)) return true;
  return false;
}

function buildDescIndex(descriptions = []) {
  const index = new Map();
  for (const d of descriptions) index.set(`${d.classid}_${d.instanceid}`, d);
  return index;
}

// Returns true for medals, coins, and other collectibles that have no
// trade/investment value. Checks the Steam tags array on the description.
function isCollectible(desc) {
  if ((desc.tags || []).some(t =>
    t.internal_name === 'CSGO_Type_Collectible' ||
    (t.category === 'Type' && (t.localized_tag_name || '').toLowerCase().includes('collectible'))
  )) return true;
  // Vanilla (stock) weapons have type starting with "Stock"
  if ((desc.type || '').startsWith('Stock')) return true;
  return false;
}

export async function runSync({ force = false, steamId = null } = {}) {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const effectiveSteamId = steamId || process.env.STEAM_ID;
  const state = await loadState(steamId);

  if (!force && state.syncLockAt && startedAtMs - state.syncLockAt < LOCK_TTL_MS) {
    return { ok: true, skipped: 'locked', state };
  }

  state.syncLockAt = startedAtMs;
  await saveState(state, steamId);

  try {
    const apiKey = process.env.STEAM_API_KEY;
    const accessToken = await getAccessToken(effectiveSteamId);

    // First run (or after a reset): take inventory snapshot as baseline and
    // immediately surface any items that are on a trade/market hold — these
    // are definitively new acquisitions that haven't been tracked yet.
    if (!state.hasInitialSnapshot) {
      let snapshot = state.snapshot ?? null;
      const firstRunPending = [];
      if (effectiveSteamId) {
        try {
          const data = await fetchInventory(effectiveSteamId);
          snapshot = buildSnapshotFromInventory(data);
          const descIndex = new Map();
          for (const d of data.descriptions || []) {
            descIndex.set(`${d.classid}_${d.instanceid}`, d);
          }
          const alreadyPending = new Set(state.pending.map(p => p.assetid));
          for (const asset of data.assets || []) {
            if (Number(asset.appid) !== 730 || String(asset.contextid) !== '2') continue;
            const desc = descIndex.get(`${asset.classid}_${asset.instanceid}`);
            if (!desc || !(desc.market_tradable_restriction > 0)) continue;
            if (isCollectible(desc)) continue;
            if (alreadyPending.has(asset.assetid)) continue;
            firstRunPending.push({
              type: 'incoming',
              assetid: asset.assetid,
              marketHashName: desc.market_hash_name || desc.name || '(unknown)',
              iconUrl: desc.icon_url || '',
              detectedAt: startedAt,
            });
          }
        } catch { /* leave snapshot null */ }
      }
      // Reload fresh state so concurrent dismissals aren't clobbered.
      const freshForInit = await loadState(steamId);
      const dismissedForInit = new Set(freshForInit.dismissedAssetIds || []);
      const next = {
        ...freshForInit,
        hasInitialSnapshot: true,
        firstSyncAt: freshForInit.firstSyncAt || startedAt,
        snapshot,
        pending: freshForInit.pending
          .filter(p => !isTombstoned(dismissedForInit, p))
          .concat(firstRunPending.filter(p => !isTombstoned(dismissedForInit, p))),
        lastTradeTime: Math.floor(Date.now() / 1000) - 24 * 60 * 60,
        lastSync: startedAt,
        lastSyncOk: true,
        lastError: null,
        syncLockAt: 0,
      };
      await saveState(next, steamId);
      return { ok: true, initial: true, added: firstRunPending.length, state: next };
    }

    // Run trade history check and inventory fetch in parallel.
    const [response, inventoryData] = await Promise.all([
      fetchTradeHistory(accessToken, apiKey),
      effectiveSteamId ? fetchInventory(effectiveSteamId).catch(() => null) : Promise.resolve(null),
    ]);

    const descIndex = buildDescIndex(response.descriptions);

    // k_ETradeStatus: 2=Committed, 3=Complete, 10=InEscrow
    const RELEVANT_STATUSES = new Set([2, 3, 10]);
    const trades = (response.trades || []).filter(t => RELEVANT_STATUSES.has(t.status));

    // Resolve missing descriptions via GetAssetClassInfo.
    const allAssets = trades.flatMap(t => [
      ...(t.assets_received || []),
      ...(t.assets_given || []),
    ]).filter(a => Number(a.appid) === 730 && String(a.contextid) === '2');

    const missingDescs = allAssets.filter(
      a => !descIndex.has(`${a.classid}_${a.instanceid}`)
    );
    if (missingDescs.length && apiKey) {
      const fallback = await fetchAssetClassInfo(apiKey, missingDescs.map(a => ({
        classid: a.classid,
        instanceid: a.instanceid,
      })));
      for (const [k, v] of fallback) descIndex.set(k, v);
    }

    const seen = new Set(state.pending.map(p => `${p.type}:${p.assetid}`));
    const processedTrades = new Set(state.processedTradeIds || []);
    const append = [];
    const newTradeIds = [];
    let maxTime = state.lastTradeTime || 0;
    const eightDaysAgo = Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60;
    const firstSyncTs = state.firstSyncAt
      ? Math.floor(new Date(state.firstSyncAt).getTime() / 1000)
      : eightDaysAgo;

    for (const trade of trades) {
      maxTime = Math.max(maxTime, trade.time_init || 0);
      if (processedTrades.has(trade.tradeid)) continue;

      const addAssets = (assets, type) => {
        for (const asset of assets || []) {
          if (Number(asset.appid) !== 730) continue;
          if (String(asset.contextid) !== '2') continue;
          const desc = descIndex.get(`${asset.classid}_${asset.instanceid}`)
            || descIndex.get(`${asset.classid}_0`);
          if (!desc || !desc.market_hash_name) continue;
          const assetid = asset.new_assetid || asset.assetid;
          // Incoming: only surface trades within the 8-day hold window
          if (type === 'incoming' && (trade.time_init || 0) < eightDaysAgo) continue;
          // Outgoing: only surface trades that happened after the user's first sync
          if (type === 'outgoing' && (trade.time_init || 0) < firstSyncTs) continue;
          const key = `${type}:${assetid}`;
          if (seen.has(key)) continue;
          append.push({
            type,
            assetid,
            tradeid: trade.tradeid,
            marketHashName: desc.market_hash_name || desc.name || '(unknown)',
            iconUrl: desc.icon_url || '',
            detectedAt: new Date((trade.time_init || 0) * 1000).toISOString(),
          });
          seen.add(key);
        }
      };

      addAssets(trade.assets_received, 'incoming');
      addAssets(trade.assets_given, 'outgoing');
      newTradeIds.push(trade.tradeid);
      processedTrades.add(trade.tradeid);
    }

    // Inventory snapshot diff — catches items from marketplace trades or Steam
    // Market purchases where GetTradeOffers is delayed or returns no state 11.
    // Only items with an active hold (market_tradable_restriction > 0) are
    // surfaced: those are definitively recent acquisitions. Fully tradable
    // items are skipped to avoid flagging pre-existing stock that predates
    // the snapshot baseline.
    let newSnapshot = state.snapshot ?? null;
    if (inventoryData) {
      newSnapshot = buildSnapshotFromInventory(inventoryData);
      if (state.snapshot != null) {
        const prevAssetids = new Set(Object.keys(state.snapshot));
        const invDescIndex = new Map();
        for (const d of inventoryData.descriptions || []) {
          invDescIndex.set(`${d.classid}_${d.instanceid}`, d);
        }
        for (const asset of inventoryData.assets || []) {
          if (Number(asset.appid) !== 730 || String(asset.contextid) !== '2') continue;
          if (prevAssetids.has(asset.assetid)) continue;
          const desc = invDescIndex.get(`${asset.classid}_${asset.instanceid}`);
          if (!desc || !(desc.market_tradable_restriction > 0)) continue;
          if (isCollectible(desc)) continue;
          const key = `incoming:${asset.assetid}`;
          if (seen.has(key)) continue;
          append.push({
            type: 'incoming',
            assetid: asset.assetid,
            marketHashName: desc.market_hash_name || desc.name || '(unknown)',
            iconUrl: desc.icon_url || '',
            detectedAt: startedAt,
          });
          seen.add(key);
        }
      }
    }

    // Reload fresh state before saving so concurrent dismissals aren't clobbered.
    const fresh = await loadState(steamId);

    // Filter fresh.pending against the dismissed tombstone set. This handles
    // the race where dismiss saves AFTER sync's fresh reload: the tombstone
    // ensures a dismissed item is never written back into pending even if it
    // was still in fresh.pending at reload time.
    const dismissed = new Set(fresh.dismissedAssetIds || []);
    const filteredPending = fresh.pending.filter(p => !isTombstoned(dismissed, p));

    // Also filter append itself against the tombstone (belt-and-suspenders).
    const cleanAppend = append.filter(p => !isTombstoned(dismissed, p));

    const finalPending = filteredPending.concat(cleanAppend);

    const next = {
      ...fresh,
      pending: finalPending,
      snapshot: newSnapshot !== null ? newSnapshot : (fresh.snapshot ?? state.snapshot),
      processedTradeIds: [...new Set([
        ...(fresh.processedTradeIds || []),
        ...processedTrades,
      ])].slice(-500),
      dismissedAssetIds: fresh.dismissedAssetIds || [],
      lastTradeTime: Math.max(maxTime, fresh.lastTradeTime || 0),
      lastSync: startedAt,
      lastSyncOk: true,
      lastError: null,
      syncLockAt: 0,
    };
    await saveState(next, steamId);
    return { ok: true, added: cleanAppend.length, state: next };

  } catch (err) {
    // Use fresh state here too so a dismiss that raced with a failing sync
    // is not overwritten.
    const fresh = await loadState(steamId).catch(() => state);
    const failed = {
      ...fresh,
      lastSync: startedAt,
      lastSyncOk: false,
      lastError: err.message || String(err),
      syncLockAt: 0,
    };
    await saveState(failed, steamId);
    return { ok: false, error: failed.lastError, state: failed };
  }
}

export default runSync;
export { DEFAULT_STATE };
