// Helpers for the Buff163 / CSFloat sell prices shown on Home.
import { getPlatformFee } from "./platformFees";

export const SELL_PRICE_MARKETS = [
  { id: "buff163", label: "Buff" },
  { id: "csfloat", label: "CSFloat" },
];

// Prices older than this are not shown at all.
export const SELL_PRICE_MAX_AGE_MS = 60 * 60 * 1000;

export function formatAge(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

// One market's price for an item, ready to render.
// state: 'ok' (fresh price), 'none' (fresh, but nothing listed), 'stale'
// (older than an hour or never fetched), 'error' (last lookup failed).
export function describePrice(entry, market, now) {
  if (!entry || !entry.at) {
    return entry?.error ? { state: "error", note: entry.error } : { state: "stale", note: "No price yet" };
  }
  const age = now - entry.at;
  if (age > SELL_PRICE_MAX_AGE_MS) {
    return { state: "stale", note: `Last price is ${formatAge(age)}, older than 1 hour` };
  }
  if (entry.priceUsd == null) return { state: "none", note: `Nothing listed · checked ${formatAge(age)}` };
  const net = entry.priceUsd * (1 - getPlatformFee(market));
  return { state: "ok", priceUsd: entry.priceUsd, net, age };
}

// Both markets for one item, plus which one pays more after fees.
export function sellPricesFor(prices, name, now) {
  const rows = SELL_PRICE_MARKETS.map((m) => ({
    ...m,
    ...describePrice(prices?.[name]?.[m.id], m.id, now),
  }));
  const priced = rows.filter((r) => r.state === "ok");
  const best = priced.length > 1 ? priced.reduce((a, b) => (b.net > a.net ? b : a)).id : null;
  return { rows, best };
}
