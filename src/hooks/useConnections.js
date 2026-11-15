// Marketplace connections for the signed-in user. The server keeps the keys;
// this hook only ever sees their status.
import { useCallback, useEffect, useState } from "react";

const URL = "/api/items?connections=1";

async function call(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data.connections || {};
}

export default function useConnections(enabled) {
  const [connections, setConnections] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setConnections(await call(URL));
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  // Both throw with a message to show next to the form.
  const connect = useCallback(async (provider, fields) => {
    setConnections(await call(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, fields }),
    }));
  }, []);

  const disconnect = useCallback(async (provider) => {
    setConnections(await call(`${URL}&provider=${encodeURIComponent(provider)}`, { method: "DELETE" }));
  }, []);

  return { connections, loadError, refresh, connect, disconnect };
}
