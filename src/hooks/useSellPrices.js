// YouPin / CSFloat sell prices for the items the user owns, shown on Home.
// CSFloat comes from the SkinROI extension, YouPin from SteamDT on the
// server; this only reads them back. Polls while enabled and the tab
// is visible. Logged-in users only (guests have no extension pairing).
import { useCallback, useEffect, useState } from "react";

const BASE = process.env.REACT_APP_STEAM_SYNC_URL || "";
const POLL_MS = 60 * 1000;

export function useSellPrices(enabled) {
  // null until the first answer, so Home doesn't warn "none yet" before it has asked.
  const [data, setData] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/items?sellPrices=1`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      setData({ prices: json.prices || {}, status: json.status || {} });
    } catch {
      // Offline or backend hiccup: keep what we have; prices age out on their own.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return enabled ? data : null;
}
