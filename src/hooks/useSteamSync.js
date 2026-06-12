import { useCallback, useEffect, useRef, useState } from 'react';

// Steam-sync API base URL.
//
// Resolution order:
//   1. REACT_APP_STEAM_SYNC_URL — explicit override (dev)
//   2. '' (empty) — use relative paths /api/inventory/* which works in:
//        • Vercel dev / production (functions live under /api)
//        • CRA dev when proxying via package.json "proxy" field
//
// IMPORTANT: never put secrets in REACT_APP_* variables — they are baked
// into the JS bundle. STEAM_ID and KV credentials live only in Vercel's
// server-side env store.
const BASE = process.env.REACT_APP_STEAM_SYNC_URL || '';

const FRONTEND_POLL_MS = 30 * 1000;
const STALE_MS = 5 * 60 * 1000;

const EMPTY_STATE = {
  lastSync: null,
  lastSyncOk: null,
  lastError: null,
  hasInitialSnapshot: false,
  pending: [],
  pollIntervalMin: 5,
};

export function useSteamSync() {
  const [state, setState] = useState(EMPTY_STATE);
  const [reachable, setReachable] = useState(null); // null = unknown, false = down, true = up
  const [busy, setBusy] = useState(false);
  const [hasTokenSetup, setHasTokenSetup] = useState(null); // null = unknown
  const [tokenExpired, setTokenExpired] = useState(false);
  const [hasRefreshToken, setHasRefreshToken] = useState(false);
  const [refreshTokenExp, setRefreshTokenExp] = useState(null);
  const aliveRef = useRef(true);

  const fetchQrStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/token`);
      if (!res.ok) return;
      const data = await res.json();
      if (!aliveRef.current) return;
      setHasTokenSetup(!!data.hasToken);
      setTokenExpired(!!data.tokenExpired);
      setHasRefreshToken(!!data.hasRefreshToken);
      setRefreshTokenExp(data.refreshTokenExp || null);
    } catch {
      // Best-effort — leave hasTokenSetup as-is on failure.
    }
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/inventory/state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!aliveRef.current) return null;
      setState((prev) => ({ ...prev, ...data }));
      setReachable(true);
      return data;
    } catch (err) {
      if (!aliveRef.current) return null;
      setReachable(false);
      return null;
    }
  }, []);

  const sync = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/api/inventory/sync`, { method: 'POST' });
      if (res.status === 401) return; // not logged in — auto-sync on mount, ignore silently
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!aliveRef.current) return;
      if (data.state) {
        setState((prev) => ({ ...prev, ...data.state }));
      } else {
        await fetchState();
      }
      setReachable(true);
    } catch (err) {
      if (aliveRef.current) setReachable(false);
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [fetchState]);

  const dismiss = useCallback(async (assetidOrIds, type) => {
    const assetids = Array.isArray(assetidOrIds) ? assetidOrIds : [assetidOrIds];
    const ids = new Set(assetids.map(String));
    // Single optimistic update for all ids so concurrent bulk dismisses are atomic.
    setState((prev) => ({
      ...prev,
      pending: prev.pending.filter(
        (p) => !(ids.has(String(p.assetid)) && (!type || p.type === type))
      ),
    }));
    // Sequential API calls — avoids server-side read-modify-write races.
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
    fetchQrStatus();
    (async () => {
      const data = await fetchState();
      if (!aliveRef.current || !data) return;
      const stale = !data.lastSync || Date.now() - new Date(data.lastSync).getTime() > STALE_MS;
      if (stale) sync();
    })();
    const id = setInterval(fetchState, FRONTEND_POLL_MS);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
  }, [fetchState, fetchQrStatus, sync]);

  return {
    pending: state.pending,
    pendingCount: state.pending.length,
    incoming: state.pending.filter((p) => p.type === 'incoming'),
    outgoing: state.pending.filter((p) => p.type === 'outgoing'),
    lastSync: state.lastSync,
    lastSyncOk: state.lastSyncOk,
    lastError: state.lastError,
    hasInitialSnapshot: state.hasInitialSnapshot,
    pollIntervalMin: state.pollIntervalMin,
    reachable,
    busy,
    sync,
    dismiss,
    hasTokenSetup,
    tokenExpired,
    hasRefreshToken,
    refreshTokenExp,
    refreshTokenStatus: fetchQrStatus,
  };
}
