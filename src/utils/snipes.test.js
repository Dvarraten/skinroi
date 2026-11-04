import {
  DEFAULT_SNIPE_FILTERS, evaluateDeal, liquidityScore, migrateFilters, passesFilters, selectSnipes,
} from "./snipes";

const NOW = 1_800_000_000_000;

const ref = (over = {}) => ({
  priceUsd: 100, askUsd: 100, bidUsd: null, count: 200, liquidity: 9,
  change7d: 1, updatedAt: NOW, ...over,
});

const deal = (over = {}) => ({
  id: "csfloat:1", market: "csfloat", name: "AK-47 | Redline (Field-Tested)",
  phase: null, priceUsd: 80, stickers: [], tradeLocked: false, seenAt: NOW,
  refs: { youpin: ref(), buff163: ref({ priceUsd: 90 }) }, ...over,
});

const f = (over = {}) => ({ ...DEFAULT_SNIPE_FILTERS, ...over });
const passes = (d, filters = f()) => passesFilters(evaluateDeal(d, filters), filters, { now: NOW });

test("prefers YouPin and nets out the sell fee", () => {
  const e = evaluateDeal(deal(), f());
  expect(e.refMarket).toBe("youpin");
  // 100 * (1 - 0.5%) - 80 = 19.5
  expect(e.profitUsd).toBeCloseTo(19.5);
  expect(e.roi).toBeCloseTo(19.5 / 80);
});

test("falls back to Buff163 when YouPin has no price", () => {
  const e = evaluateDeal(deal({ refs: { youpin: null, buff163: ref({ priceUsd: 90 }) } }), f());
  expect(e.refMarket).toBe("buff163");
  expect(e.profitUsd).toBeCloseTo(90 * 0.985 - 80);
});

test("buy fee is added to cost", () => {
  const e = evaluateDeal(deal(), f({ buyFee: 10 }));
  expect(e.profitUsd).toBeCloseTo(99.5 - 88);
});

test("hides illiquid items", () => {
  expect(passes(deal())).toBe(true);
  expect(passes(deal({ refs: { youpin: ref({ count: 3 }) } }))).toBe(false);
});

test("uses buy-order spread when listing counts are unknown", () => {
  const buffOnly = (bidUsd) => deal({
    refs: { buff163: ref({ count: null, liquidity: null, bidUsd, askUsd: 100, priceUsd: 100 }) },
  });
  expect(passes(buffOnly(90))).toBe(true);
  expect(passes(buffOnly(60))).toBe(false);
  expect(passes(buffOnly(null))).toBe(false);
  expect(passes(buffOnly(null), f({ hideUnknownLiquidity: false }))).toBe(true);
});

test("liquidity score weighs buy orders, spread and listings", () => {
  expect(liquidityScore("youpin", ref({ bidCount: 100, bidUsd: 95, askUsd: 100, count: 200 }))).toBe(96);
  expect(liquidityScore("youpin", ref({ bidCount: 2, bidUsd: 70, askUsd: 100, count: 5 }))).toBeLessThan(25);
  expect(liquidityScore("csfloat", { priceUsd: 100, sales: 50, steamVolume: 50 })).toBe(100);
  expect(liquidityScore("csfloat", { priceUsd: 100 })).toBe(null);
});

test("sells where it pays most among liquid sell markets", () => {
  const csfloat = { priceUsd: 120, sales: 40, steamVolume: 30 };
  const d = deal({ refs: { youpin: ref(), csfloat } });
  expect(evaluateDeal(d, f()).refMarket).toBe("youpin");
  const both = evaluateDeal(d, f({ sellMarkets: ["youpin", "csfloat"] }));
  expect(both.refMarket).toBe("csfloat");
  expect(both.profitUsd).toBeCloseTo(120 * 0.98 - 80);
  // A higher price on an illiquid market loses to a liquid one.
  const thin = deal({ refs: { youpin: ref(), csfloat: { priceUsd: 120, sales: 1, steamVolume: 0 } } });
  expect(evaluateDeal(thin, f({ sellMarkets: ["youpin", "csfloat"] })).refMarket).toBe("youpin");
});

test("a YouPin lowest ask is never sold back on YouPin", () => {
  const d = deal({ id: "youpin:x", market: "youpin", itemLevel: true, refs: { youpin: ref(), buff163: ref({ priceUsd: 90 }) } });
  expect(evaluateDeal(d, f()).refMarket).toBe("buff163");
  expect(passes(d)).toBe(false); // YouPin isn't a default buy market
  expect(passes(d, f({ buyMarkets: ["youpin"] }))).toBe(true);
});

test("old saved filters keep their buy markets and lose the old liquidity fields", () => {
  const m = migrateFilters({ markets: ["dmarket"], reference: "youpin", minListings: 20, minBidAsk: 85, minLiquidity: 0, minRoi: 8 });
  expect(m).toEqual({ buyMarkets: ["dmarket"], minRoi: 8, version: DEFAULT_SNIPE_FILTERS.version });
  expect(migrateFilters(null)).toBe(null);
});

test("hides volatile, stale, old and unprofitable deals", () => {
  expect(passes(deal({ refs: { youpin: ref({ change7d: -30 }) } }))).toBe(false);
  expect(passes(deal({ refs: { youpin: ref({ updatedAt: NOW - 3 * 3600_000 }) } }))).toBe(false);
  expect(passes(deal({ seenAt: NOW - 60 * 60_000 }))).toBe(false);
  expect(passes(deal({ priceUsd: 98 }))).toBe(false);
});

test("market, search and type filters", () => {
  expect(passes(deal(), f({ buyMarkets: ["dmarket"] }))).toBe(false);
  expect(passes(deal(), f({ search: "ak redline" }))).toBe(true);
  expect(passes(deal(), f({ search: "awp" }))).toBe(false);
  expect(passes(deal({ name: "Souvenir AWP | Dragon Lore (Factory New)" }))).toBe(false);
  expect(passes(deal({ name: "StatTrak™ AK-47 | Redline (Field-Tested)" }), f({ hideStatTrak: true }))).toBe(false);
});

test("sorts by ROI by default", () => {
  const list = selectSnipes(
    [deal({ id: "a", priceUsd: 90 }), deal({ id: "b", priceUsd: 70 })],
    f(),
    { now: NOW },
  );
  expect(list.map((d) => d.id)).toEqual(["b", "a"]);
});
