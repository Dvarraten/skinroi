// Helpers for the YouPin / CSFloat sell prices shown on Home.
import { getPlatformFee } from "./platformFees";

// maxAgeMs: prices older than this are not shown. YouPin is re-read from
// SteamDT on every load, so an hour is plenty. CSFloat prices for owned items
// cost the extension a rate-limited CSFloat call each, so it refreshes them
// only every 48 h (extension config SELL_PRICES_REFRESH_AFTER_MS); the extra
// 2 h covers the wait in the extension's queue before the refresh lands.
export const SELL_PRICE_MARKETS = [
  { id: "youpin", label: "YouPin", maxAgeMs: 60 * 60 * 1000 },
  { id: "csfloat", label: "CSFloat", maxAgeMs: 50 * 60 * 60 * 1000 },
];

// Doppler phase handling, mirrored from api/_lib/doppler-phase.js (keep in
// step). Prices are stored under name + "|Phase 2" etc. for Dopplers.
const PAINT_INDEX_PHASES = {
  415: "Ruby", 416: "Sapphire", 417: "Black Pearl",
  418: "Phase 1", 419: "Phase 2", 420: "Phase 3", 421: "Phase 4",
  852: "Phase 1", 853: "Phase 2", 854: "Phase 3", 855: "Phase 4",
  568: "Emerald", 569: "Phase 1", 570: "Phase 2", 571: "Phase 3", 572: "Phase 4",
  1119: "Emerald", 1120: "Phase 1", 1121: "Phase 2", 1122: "Phase 3", 1123: "Phase 4",
};
const PHASE_IN_NAME = /\b((?:Gamma )?Doppler) (Phase [1-4]|Ruby|Sapphire|Black Pearl|Emerald)\b/;

export function sellPriceKey(item) {
  const raw = typeof item?.itemName === "string" ? item.itemName.trim() : "";
  let name = raw;
  let phase = null;
  const m = raw.match(PHASE_IN_NAME);
  if (m) {
    phase = m[2];
    name = raw.replace(m[0], m[1]);
  }
  if (!phase && /\bDoppler\b/.test(name) && Number.isInteger(item?.paintIndex)) {
    phase = PAINT_INDEX_PHASES[item.paintIndex] || null;
  }
  return phase ? `${name}|${phase}` : name;
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
