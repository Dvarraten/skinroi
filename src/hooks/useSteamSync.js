import { useCallback, useEffect, useRef, useState } from 'react';

// Frontend adapter for the extension-based sync.
//
// Since the browser extension is the sole source of trade data, this hook
// only reads state (pending items, extension connection info) and dismisses
// items the user resolves. There is no client-triggered "sync now" — the
// extension pushes whenever it detects changes.

const BASE = process.env.REACT_APP_STEAM_SYNC_URL || '';
const FRONTEND_POLL_MS = 30 * 1000;

const EMPTY_STATE = {
  lastSync: null,
  lastSyncOk: null,
  lastError: null,
  pending: [],
  extension: null,
};

export function useSteamSync() {
  const [state, setState] = useState(EMPTY_STATE);
  const [reachable, setReachable] = useState(null);
  const aliveRef = useRef(true);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/inventory/state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!aliveRef.current) return null;
      setState((prev) => ({ ...prev, ...data }));
      setReachable(true);
      return data;
    } catch {
      if (!aliveRef.current) return null;
      setReachable(false);
      return null;
    }
  }, []);

  const dismiss = useCallback(async (assetidOrIds, type) => {
    const assetids = Array.isArray(assetidOrIds) ? assetidOrIds : [assetidOrIds];
    const ids = new Set(assetids.map(String));
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
