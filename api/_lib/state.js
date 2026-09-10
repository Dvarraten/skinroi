// Upstash Redis adapter for the per-user pending list.
//
// Single key holds the whole state JSON:
//   {
//     lastSync, lastSyncOk, lastError,
//     pending:              [ { type, assetid, tradeid?, marketHashName, iconUrl, detectedAt } ],
//     dismissedAssetIds:    [ "type:assetid" ]  tombstones
//     processedTradeIds:    [ "tradeid" ]       last-500 push-dedup
//   }
//
// The state is written by /api/extension/trades (extension push) and read by
// /api/inventory/state (frontend poll) and /api/inventory/dismiss.

import { getRedis } from './redis.js';

const STATE_KEY = (steamId) =>
  steamId ? `skinroi:sync:${steamId}:state` : 'skinroi:state';

export const DEFAULT_STATE = {
  lastSync: null,
  lastSyncOk: null,
  lastError: null,
  pending: [],
  dismissedAssetIds: [],
  processedTradeIds: [],
};

export async function loadState(steamId = null) {
  const client = getRedis();
  const raw = await client.get(STATE_KEY(steamId));
  if (raw) {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...DEFAULT_STATE, ...parsed };
  }
  return { ...DEFAULT_STATE };
}

export async function saveState(state, steamId = null) {
  const client = getRedis();
  await client.set(STATE_KEY(steamId), state);
}

// Public-facing slice served by GET /api/inventory/state.
export function publicState(state, extras = {}) {
  return {
    lastSync: state.lastSync,
    lastSyncOk: state.lastSyncOk,
    lastError: state.lastError,
    pending: state.pending,
    extension: null,
    ...extras,
  };
}
