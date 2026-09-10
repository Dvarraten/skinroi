import { useCallback, useEffect, useRef, useState } from 'react';

// Frontend adapter for the extension-based sync.
//
// Since the browser extension is the sole source of trade data, this hook
// only reads state (pending items, extension connection info) and dismisses
// items the user resolves. There is no client-triggered "sync now" — the
// extension pushes whenever it detects changes.

const BASE = process.env.REACT_APP_STEAM_SYNC_URL || '';
const FRONTEND_POLL_MS = 30 * 1000;

// How long a locally-dismissed item stays in the client-side tombstone map.
// Long enough that any in-flight state poll can't race and revive it, but
// short enough that a legitimate re-trade of the same assetid (rare) still
// eventually surfaces.
const DISMISS_TOMBSTONE_MS = 60 * 1000;

const EMPTY_STATE = {
  lastSync: null,
  lastSyncOk: null,
  lastError: null,
  pending: [],
  extension: null,
};

function tombstoneKey(assetid, type) {
  return `${type || '*'}:${assetid}`;
}

export function useSteamSync() {
  const [state, setState] = useState(EMPTY_STATE);
  const [reachable, setReachable] = useState(null);
  const aliveRef = useRef(true);
  // Map of tombstoneKey → expiryTimestamp. Any pending item whose
  // "type:assetid" matches a live tombstone is filtered out of poll
  // responses. Prevents the "I marked it sold, it reappeared" race:
  // an in-flight state poll can arrive after the dismiss request was
  // sent but before Redis has finished writing the removal.
  const dismissedRef = useRef(new Map());

  const filterDismissed = useCallback((pending) => {
    if (!Array.isArray(pending) || pending.length === 0) return pending || [];
    const now = Date.now();
    const tomb = dismissedRef.current;
    // Prune expired tombstones lazily.
    for (const [k, expiry] of tomb) {
      if (expiry < now) tomb.delete(k);
    }
    if (tomb.size === 0) return pending;
    return pending.filter((p) => {
      const specific = tombstoneKey(p.assetid, p.type);
      const anyType = tombstoneKey(p.assetid, null);
      return !tomb.has(specific) && !tomb.has(anyType);
    });
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/inventory/state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!aliveRef.current) return null;
      const merged = { ...data };
      if (Array.isArray(data.pending)) {
        merged.pending = filterDismissed(data.pending);
      }
      setState((prev) => ({ ...prev, ...merged }));
      setReachable(true);
      return data;
    } catch {
      if (!aliveRef.current) return null;
      setReachable(false);
      return null;
    }
  }, [filterDismissed]);

  const dismiss = useCallback(async (assetidOrIds, type) => {
    const assetids = Array.isArray(assetidOrIds) ? assetidOrIds : [assetidOrIds];
    const ids = new Set(assetids.map(String));
    // Optimistic UI update AND client-side tombstone so a concurrent state
    // poll can't revive the item before the server has finished writing.
    const now = Date.now();
    const expiry = now + DISMISS_TOMBSTONE_MS;
    for (const assetid of ids) {
      dismissedRef.current.set(tombstoneKey(assetid, type), expiry);
    }
    setState((prev) => ({
      ...prev,
      pending: prev.pending.filter(
        (p) => !(ids.has(String(p.assetid)) && (!type || p.type === type))
      ),
    }));
    for (const assetid of assetids) {
      try {
        await fetch(`${BASE}/api/inventory/dismiss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetid, type }),
        });
      } catch {
        fetchState();
      }
    }
  }, [fetchState]);

  useEffect(() => {
    aliveRef.current = true;
    fetchState();
    const id = setInterval(fetchState, FRONTEND_POLL_MS);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
  }, [fetchState]);

  return {
    pending: state.pending,
    pendingCount: state.pending.length,
    incoming: state.pending.filter((p) => p.type === 'incoming'),
    outgoing: state.pending.filter((p) => p.type === 'outgoing'),
    lastSync: state.lastSync,
    lastSyncOk: state.lastSyncOk,
    lastError: state.lastError,
    extension: state.extension,
    reachable,
    dismiss,
    refreshState: fetchState,
  };
}
