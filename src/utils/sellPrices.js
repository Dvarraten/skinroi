// Helpers for the YouPin / CSFloat sell prices shown on Home.
import { getPlatformFee } from "./platformFees";
import { sellPriceTarget } from "../shared/dopplerPhase.js";

// maxAgeMs: prices older than this are not shown. YouPin is re-read from
// SteamDT on every load, so an hour is plenty. CSFloat prices for owned items
// cost the extension a rate-limited CSFloat call each, so it refreshes them
// only every 48 h (extension config SELL_PRICES_REFRESH_AFTER_MS); the extra
// 2 h covers the wait in the extension's queue before the refresh lands.
export const SELL_PRICE_MARKETS = [
  { id: "youpin", label: "YouPin", maxAgeMs: 60 * 60 * 1000 },
  { id: "csfloat", label: "CSFloat", maxAgeMs: 50 * 60 * 60 * 1000 },
];

// Prices are stored under name + "|Phase 2" etc. for Dopplers; the phase
// logic is shared with the API (src/shared/dopplerPhase.js).
export function sellPriceKey(item) {
  return sellPriceTarget(item).key;
}

// Default for markets without their own maxAgeMs; also how long a market's
// error status stays on screen.
export const SELL_PRICE_MAX_AGE_MS = 60 * 60 * 1000;

export function maxAgeFor(market) {
  return SELL_PRICE_MARKETS.find((m) => m.id === market)?.maxAgeMs ?? SELL_PRICE_MAX_AGE_MS;
}

function formatLimit(ms) {
  const h = Math.round(ms / 3600000);
  return h === 1 ? "1 hour" : `${h} hours`;
}

export function formatAge(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

// One market's price for an item, ready to render.
// state: 'ok' (fresh price), 'none' (fresh, but nothing listed), 'stale'
// (older than the market's max age or never fetched), 'error' (last lookup failed).
export function describePrice(entry, market, now) {
  if (!entry || !entry.at) {
    return entry?.error ? { state: "error", note: entry.error } : { state: "stale", note: "No price yet" };
  }
  const age = now - entry.at;
  const maxAge = maxAgeFor(market);
  if (age > maxAge) {
    return { state: "stale", note: `Last price is ${formatAge(age)}, older than ${formatLimit(maxAge)}` };
  }
  if (entry.priceUsd == null) return { state: "none", note: `Nothing listed · checked ${formatAge(age)}` };
  const net = entry.priceUsd * (1 - getPlatformFee(market));
  return { state: "ok", priceUsd: entry.priceUsd, net, age, anyPhase: !!entry.anyPhase };
}

// Both markets for one item, plus which one pays more after fees.
export function sellPricesFor(prices, item, now) {
  const name = sellPriceKey(item);
  const rows = SELL_PRICE_MARKETS.map((m) => ({
    ...m,
    ...describePrice(prices?.[name]?.[m.id], m.id, now),
  }));
  // Only compare like with like: a phase price against a lowest-of-any-phase
  // price says nothing about where this copy sells best.
  const priced = rows.filter((r) => r.state === "ok");
  if (priced.length > 1 && priced.some((r) => r.anyPhase !== priced[0].anyPhase)) {
    return { rows, best: null };
  }
  const best = priced.length > 1 ? priced.reduce((a, b) => (b.net > a.net ? b : a)).id : null;
  return { rows, best };
}
