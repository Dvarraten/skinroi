import { buildDemoPortfolio, buildDemoSellPrices } from './demoPortfolio';
import { buildDemoTrades } from './demoTrades';
import { buildDemoSnipes } from './demoSnipes';
import { DEFAULT_SNIPE_FILTERS, SELL_MARKETS, selectSnipes } from './snipes';
import { groupInventory } from '../components/SteamImportModal';

test('demo portfolio has active and sold items with consistent profit', () => {
  const items = buildDemoPortfolio(Date.UTC(2026, 10, 6));
  expect(items.some((i) => !i.sold)).toBe(true);
  expect(items.some((i) => i.sold)).toBe(true);
  expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  for (const i of items.filter((x) => x.sold)) {
    expect(Number.isFinite(i.profit)).toBe(true);
    expect(i.soldAt).toBeGreaterThan(i.acquiredAt);
  }
});

test('groupInventory skips tracked assetids and groups copies without float', () => {
  const rows = [
    { assetid: '1', name: 'Kilowatt Case' },
    { assetid: '2', name: 'Kilowatt Case' },
    { assetid: '3', name: 'AK-47 | Redline (Field-Tested)', floatValue: 0.2 },
    { assetid: '4', name: 'AK-47 | Redline (Field-Tested)', floatValue: 0.3 },
    { assetid: '5', name: 'AWP | Asiimov (Field-Tested)' },
  ];
  const items = [
    { assetid: '5', itemName: 'AWP | Asiimov (Field-Tested)', sold: false },
    { itemName: 'AK-47 | Redline (Field-Tested)', sold: false },
  ];
  const groups = groupInventory(rows, items);
  expect(groups.map((g) => [g.name, g.copies.length, g.maybeTracked])).toEqual([
    ['AK-47 | Redline (Field-Tested)', 1, true],
    ['AK-47 | Redline (Field-Tested)', 1, true],
    ['Kilowatt Case', 2, false],
  ]);
});

test('demo trades: outgoing ones match held demo items, all have images', () => {
  const now = Date.UTC(2026, 10, 15);
  const held = new Set(buildDemoPortfolio(now).filter((i) => !i.sold).map((i) => i.itemName));
  const trades = buildDemoTrades(now);
  expect(trades.some((t) => t.type === 'incoming')).toBe(true);
  const outgoing = trades.filter((t) => t.type === 'outgoing');
  expect(outgoing.length).toBeGreaterThan(0);
  for (const t of outgoing) expect(held.has(t.marketHashName)).toBe(true);
  expect(new Set(trades.map((t) => t.assetid)).size).toBe(trades.length);
  for (const t of trades) expect(t.iconUrl).toBeTruthy();
});

test('every demo item has a built-in image', () => {
  const now = Date.UTC(2026, 10, 15);
  for (const i of buildDemoPortfolio(now)) expect(i.iconUrl).toMatch(/^https:\/\//);
  for (const d of buildDemoSnipes(now)) expect(d.image).toMatch(/^https:\/\//);
});

test('example snipes all pass the demo filters', () => {
  const now = Date.UTC(2026, 10, 15);
  const filters = { ...DEFAULT_SNIPE_FILTERS, sellMarkets: SELL_MARKETS, maxAgeMin: 60 };
  const deals = buildDemoSnipes(now);
  expect(selectSnipes(deals, filters, { now })).toHaveLength(deals.length);
});

test('demo sell prices cover every held demo item', () => {
  const now = Date.UTC(2026, 10, 15);
  const { prices } = buildDemoSellPrices(now);
  for (const i of buildDemoPortfolio(now).filter((x) => !x.sold)) {
    expect(prices[i.itemName]?.youpin?.priceUsd).toBeGreaterThan(0);
  }
});
