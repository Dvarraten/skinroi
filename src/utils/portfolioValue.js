// Portfolio value over time: today's snapshot from the sell prices shown on
// Portfolio, and the series the Analytics "Portfolio value" chart draws.
// Stored server-side by api/_lib/value-history.js, one row per day.
import { sellPricesFor } from "./sellPrices";

const round2 = (n) => Math.round(n * 100) / 100;
const owned = (i) => !i.sold && !i.isTransaction;

// YYYY-MM-DD in the browser's time zone.
export function localDay(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Today's figures for the items still held:
//   cost   — what they cost (the "Holding value" on Portfolio)
//   market — what they'd bring in sold now: per item the best fresh YouPin /
//            CSFloat price after fees; an item with no fresh price counts at
//            its cost so a missing price doesn't look like a crash
//   priced — how many items had a fresh price, count — how many items
export function portfolioSnapshot(items, prices, now = Date.now()) {
  let cost = 0;
  let market = 0;
  let priced = 0;
  let count = 0;
  for (const item of items || []) {
    if (!owned(item)) continue;
    const paid = Number(item.purchasePrice) || 0;
    count += 1;
    cost += paid;
    const nets = sellPricesFor(prices, item, now).rows.filter((r) => r.state === "ok").map((r) => r.net);
    if (nets.length) {
      priced += 1;
      market += Math.max(...nets);
    } else {
      market += paid;
    }
  }
  return { d: localDay(now), cost: round2(cost), market: round2(market), priced, count };
}

// Should today's snapshot be posted? Yes when today has no row yet, or the
// last post was over `minGapMs` ago and the figures moved.
export function shouldPostSnapshot(snap, lastPost, now = Date.now(), minGapMs = 6 * 60 * 60 * 1000) {
  if (!snap || snap.count === 0) return false;
  if (!lastPost || lastPost.d !== snap.d) return true;
  if (now - (lastPost.at || 0) < minGapMs) return false;
  return lastPost.cost !== snap.cost || lastPost.market !== snap.market;
}

// Replaces or adds today's row in the local copy (mirrors the server).
export function withSnapshot(history, snap) {
  const rows = (history || []).filter((r) => r.d !== snap.d);
  rows.push(snap);
  return rows.sort((a, b) => (a.d < b.d ? -1 : 1));
}

const addDays = (day, n) => {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n).getTime());
};

// Rows for the chart from `fromDay` to today: cost from the items (what was
// held at the end of each day, so it reaches back before the first
// snapshot) and market from the snapshots (null on days without one).
// fromDay null = from the first purchase.
export function valueSeries(items, history, { fromDay = null, now = Date.now() } = {}) {
  const today = localDay(now);
  const held = (items || []).filter((i) => !i.isTransaction && i.datePurchased);
  const first = held.reduce((min, i) => (i.datePurchased < min ? i.datePurchased : min), today);
  const firstSnap = history?.[0]?.d || today;
  let day = fromDay || (first < firstSnap ? first : firstSnap);
  if (day > today) day = today;

  const buys = new Map();
  const sells = new Map();
  for (const i of held) {
    const p = Number(i.purchasePrice) || 0;
    const b = i.datePurchased.slice(0, 10);
    buys.set(b, (buys.get(b) || 0) + p);
    if (i.sold) {
      const s = String(i.dateSold || b).slice(0, 10);
      sells.set(s, (sells.get(s) || 0) + p);
    }
  }
  // Cost held at the start of the range.
  let cost = 0;
  for (const [d, v] of buys) if (d < day) cost += v;
  for (const [d, v] of sells) if (d < day) cost -= v;

  const snaps = new Map((history || []).map((r) => [r.d, r]));
  const rows = [];
  for (let guard = 0; day <= today && guard < 4000; guard += 1) {
    cost += (buys.get(day) || 0) - (sells.get(day) || 0);
    const s = snaps.get(day);
    rows.push({
      d: day,
      cost: round2(Math.max(0, cost)),
      market: s ? s.market : null,
      priced: s ? s.priced : null,
      count: s ? s.count : null,
    });
    day = addDays(day, 1);
  }
  return rows;
}
