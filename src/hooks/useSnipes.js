// Polls /api/snipes while the Snipes page is open and the tab is visible.
// The server rescans at most every ~45s, so polling faster only re-reads Redis.
import { useCallback, useEffect, useRef, useState } from "react";

const BASE = process.env.REACT_APP_STEAM_SYNC_URL || "";
const POLL_MS = 20 * 1000;

export function useSnipes() {
  const [deals, setDeals] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/snipes`, { credentials: "include" });
      if (!aliveRef.current) return;
      if (res.status === 401) {
        setError("Sign in with Steam to see snipes.");
        return;
      }
      const data = await res.json();
      if (!aliveRef.current) return;
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setDeals(data.deals || []);
      setMeta(data.meta || null);
      setError(null);
    } catch (e) {
      if (aliveRef.current) setError(e.message);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { deals, meta, error, loading, refresh };
}
