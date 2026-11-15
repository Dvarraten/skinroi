// Polls /api/snipes while the Snipes page is open and the tab is visible.
// The server rescans at most every ~90s and the extension pushes every 2 min,
// so polling faster only re-reads Redis. Each poll sends ?since= so an
// unchanged deal list costs one small read instead of the whole list.
// demo = logged-out preview: delayed deals without buy links, polled slowly.
import { useCallback, useEffect, useRef, useState } from "react";

const BASE = process.env.REACT_APP_STEAM_SYNC_URL || "";
const POLL_MS = 30 * 1000;
const DEMO_POLL_MS = 60 * 1000;

export function useSnipes({ demo = false } = {}) {
  const [deals, setDeals] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);
  const sinceRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const since = sinceRef.current;
      const url = demo
        ? `${BASE}/api/snipes?demo=1`
        : `${BASE}/api/snipes${since ? `?since=${since}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!aliveRef.current) return;
      if (res.status === 401) {
        setError("Sign in with Steam to see snipes.");
        return;
      }
      const data = await res.json();
      if (!aliveRef.current) return;
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (!data.unchanged) setDeals(data.deals || []);
      setMeta(data.meta || null);
      sinceRef.current = data.meta?.updatedAt || 0;
      setError(null);
    } catch (e) {
      if (aliveRef.current) setError(e.message);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    aliveRef.current = true;
    sinceRef.current = 0;
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, demo ? DEMO_POLL_MS : POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, demo]);

  return { deals, meta, error, loading, refresh };
}
