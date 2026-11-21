// The sidebar's "is my data live?" dot: one row per data source with a
// state, and the worst state as the overall dot.
//   ok      — fresh
//   warn    — working but old (extension asleep, no fresh prices)
//   bad     — failing (save failed, push failed, market error)
//   unknown — not checked yet in this session (left out of the overall)
import { SELL_PRICE_MARKETS, formatAge } from "./sellPrices";

// The extension polls every 5 min; three missed polls means it's asleep.
const EXTENSION_STALE_MS = 15 * 60 * 1000;
const RANK = { unknown: 0, ok: 1, warn: 2, bad: 3 };

function extensionRow(extension, now) {
  if (!extension) return { id: "extension", label: "Extension", state: "unknown", text: "Checking…" };
  if (!extension.connected) return { id: "extension", label: "Extension", state: "bad", text: "Not paired" };
  if (!extension.lastSeen) return { id: "extension", label: "Extension", state: "warn", text: "Paired, not seen yet" };
  const age = now - extension.lastSeen;
  return age > EXTENSION_STALE_MS
    ? { id: "extension", label: "Extension", state: "warn", text: `Last seen ${formatAge(age)} · is Chrome open?` }
    : { id: "extension", label: "Extension", state: "ok", text: `Seen ${formatAge(age)}` };
}

function marketRow(market, sellPrices, now) {
  const row = { id: market.id, label: `${market.label} prices` };
  if (!sellPrices) return { ...row, state: "unknown", text: "Open Portfolio to check" };
  const status = sellPrices.status?.[market.id];
  if (status && status.ok === false && now - status.at < 60 * 60 * 1000) {
    return { ...row, state: "bad", text: status.error || "Last lookup failed" };
  }
  let newest = 0;
  for (const entry of Object.values(sellPrices.prices || {})) {
    const at = entry?.[market.id]?.at;
    if (at && at > newest) newest = at;
  }
  if (!newest) return { ...row, state: "warn", text: "No prices yet" };
  const age = now - newest;
  return age > market.maxAgeMs
    ? { ...row, state: "warn", text: `Newest is ${formatAge(age)}` }
    : { ...row, state: "ok", text: `Updated ${formatAge(age)}` };
}

export function freshnessRows({ extension, sellPrices, saveStatus, reachable, lastSyncOk, lastError, now = Date.now() }) {
  const rows = [extensionRow(extension, now)];
  if (reachable === false) {
    rows.push({ id: "sync", label: "Trade sync", state: "bad", text: "Backend unreachable" });
  } else if (lastSyncOk === false) {
    rows.push({ id: "sync", label: "Trade sync", state: "bad", text: `Last push failed: ${lastError || "unknown error"}` });
  }
  for (const m of SELL_PRICE_MARKETS) rows.push(marketRow(m, sellPrices, now));
  rows.push(saveStatus === "failed"
    ? { id: "save", label: "Portfolio", state: "bad", text: "Not saved · retrying" }
    : saveStatus === "conflict"
      ? { id: "save", label: "Portfolio", state: "warn", text: "Reloaded after a change in another tab" }
      : { id: "save", label: "Portfolio", state: "ok", text: "Saved" });

  const worst = rows.reduce((w, r) => (RANK[r.state] > RANK[w.state] ? r : w), { state: "unknown" });
  const summary = worst.state === "ok" || worst.state === "unknown"
    ? "All data live"
    : `${worst.label}: ${worst.text}`;
  return { rows, state: worst.state === "unknown" ? "ok" : worst.state, summary };
}
