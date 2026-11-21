// Daily portfolio value snapshots (Analytics "Portfolio value" chart).
// Reads the stored history once per sign-in, and posts today's snapshot
// when Portfolio has fresh sell prices: the first time each day, then at
// most every 6 h when the figures moved (Redis budget).
import { useEffect, useState } from "react";
import { shouldPostSnapshot, withSnapshot } from "../utils/portfolioValue";

const BASE = process.env.REACT_APP_STEAM_SYNC_URL || "";
const lastPostKey = (steamId) => `skinroi-valuehist-${steamId}`;
const readLastPost = (steamId) => {
  try { return JSON.parse(localStorage.getItem(lastPostKey(steamId)) || "null"); } catch { return null; }
};

export function useValueHistory(steamId, snapshot) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    setHistory(null);
    if (!steamId) return undefined;
    let cancelled = false;
    fetch(`${BASE}/api/items?history=1`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((json) => { if (!cancelled) setHistory(Array.isArray(json.history) ? json.history : []); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [steamId]);

  useEffect(() => {
    if (!steamId || !snapshot) return;
    const now = Date.now();
    if (!shouldPostSnapshot(snapshot, readLastPost(steamId), now)) return;
    try { localStorage.setItem(lastPostKey(steamId), JSON.stringify({ ...snapshot, at: now })); } catch { /* ignore */ }
    fetch(`${BASE}/api/items?history=1`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setHistory((h) => withSnapshot(h, snapshot));
      })
      // Let the next load try again instead of waiting 6 h.
      .catch(() => { try { localStorage.removeItem(lastPostKey(steamId)); } catch { /* ignore */ } });
  }, [steamId, snapshot]);

  return history;
}
