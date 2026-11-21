import { portfolioSnapshot, shouldPostSnapshot, withSnapshot, valueSeries, localDay } from "./portfolioValue";

const NOW = new Date(2026, 10, 21, 14, 0).getTime();
const fresh = (priceUsd) => ({ priceUsd, at: NOW - 60 * 1000 });

describe("portfolioSnapshot", () => {
  const items = [
    { itemName: "AK-47 | Redline (Field-Tested)", purchasePrice: 10, sold: false },
    { itemName: "AWP | Asiimov (Field-Tested)", purchasePrice: 50, sold: false },
    { itemName: "Glock-18 | Fade (Factory New)", purchasePrice: 900, sold: true },
    { itemName: "Deposit", purchasePrice: 100, sold: false, isTransaction: true },
  ];

  it("uses the best net price per item and cost for unpriced ones", () => {
    const prices = { "AK-47 | Redline (Field-Tested)": { youpin: fresh(20), csfloat: fresh(12) } };
    const snap = portfolioSnapshot(items, prices, NOW);
    expect(snap.d).toBe("2026-11-21");
    expect(snap.cost).toBe(60);
    expect(snap.count).toBe(2);
    expect(snap.priced).toBe(1);
    // YouPin 20 after its fee beats CSFloat 12; the AWP counts at cost.
    expect(snap.market).toBeGreaterThan(60);
    expect(snap.market).toBeLessThan(70);
  });

  it("ignores stale prices", () => {
    const prices = { "AK-47 | Redline (Field-Tested)": { youpin: { priceUsd: 20, at: NOW - 3 * 3600 * 1000 } } };
    expect(portfolioSnapshot(items, prices, NOW).priced).toBe(0);
  });
});

describe("shouldPostSnapshot", () => {
  const snap = { d: "2026-11-21", cost: 60, market: 70, priced: 1, count: 2 };
  it("posts the first snapshot of a day", () => {
    expect(shouldPostSnapshot(snap, null, NOW)).toBe(true);
    expect(shouldPostSnapshot(snap, { d: "2026-11-20", at: NOW - 1000 }, NOW)).toBe(true);
  });
  it("waits 6 h and skips unchanged figures", () => {
    expect(shouldPostSnapshot(snap, { ...snap, market: 71, at: NOW - 3600 * 1000 }, NOW)).toBe(false);
    expect(shouldPostSnapshot(snap, { ...snap, at: NOW - 7 * 3600 * 1000 }, NOW)).toBe(false);
    expect(shouldPostSnapshot(snap, { ...snap, market: 71, at: NOW - 7 * 3600 * 1000 }, NOW)).toBe(true);
  });
  it("never posts an empty portfolio", () => {
    expect(shouldPostSnapshot({ ...snap, count: 0 }, null, NOW)).toBe(false);
  });
});

describe("valueSeries", () => {
  const items = [
    { purchasePrice: 10, datePurchased: "2026-11-18", sold: false },
    { purchasePrice: 5, datePurchased: "2026-11-19", sold: true, dateSold: "2026-11-20" },
  ];
  it("tracks cost held per day and puts snapshots on their day", () => {
    const rows = valueSeries(items, [{ d: "2026-11-20", cost: 10, market: 14, priced: 1, count: 1 }], { now: NOW });
    expect(rows.map((r) => r.d)).toEqual(["2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"]);
    expect(rows.map((r) => r.cost)).toEqual([10, 15, 10, 10]);
    expect(rows.map((r) => r.market)).toEqual([null, null, 14, null]);
  });
  it("starts at fromDay with the cost held before it", () => {
    const rows = valueSeries(items, [], { fromDay: "2026-11-20", now: NOW });
    expect(rows[0]).toMatchObject({ d: "2026-11-20", cost: 10 });
  });
});

it("withSnapshot replaces today's row", () => {
  const rows = withSnapshot([{ d: "2026-11-20" }, { d: "2026-11-21", market: 1 }], { d: "2026-11-21", market: 2 });
  expect(rows).toEqual([{ d: "2026-11-20" }, { d: "2026-11-21", market: 2 }]);
  expect(localDay(NOW)).toBe("2026-11-21");
});
