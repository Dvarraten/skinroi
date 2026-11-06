import { buildDemoPortfolio } from './demoPortfolio';
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
