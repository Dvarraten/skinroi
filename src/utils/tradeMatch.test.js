import { matchOutgoing } from './tradeMatch';

const item = (id, itemName, extra = {}) => ({ id, itemName, purchasePrice: 10, sold: false, datePurchased: '2026-11-01', ...extra });

test('same assetid is an exact match, even with other same-name items', () => {
  const items = [
    item(1, 'AWP | Asiimov (Field-Tested)'),
    item(2, 'AWP | Asiimov (Field-Tested)', { assetid: '555' }),
  ];
  const r = matchOutgoing({ assetid: '555', marketHashName: 'AWP | Asiimov (Field-Tested)' }, items);
  expect(r.exact.id).toBe(2);
  expect(r.candidates).toEqual([]);
});

test('sold items never match', () => {
  const r = matchOutgoing({ assetid: '1', marketHashName: 'X' }, [item(1, 'X', { assetid: '1', sold: true })]);
  expect(r.exact).toBeNull();
  expect(r.candidates).toEqual([]);
});

test('without an id match, same-name items without an assetid come first', () => {
  const items = [
    item(1, 'AK-47 | Slate (Field-Tested)', { assetid: '9' }),
    item(2, 'AK-47 | Slate (Field-Tested)', { datePurchased: '2026-11-05' }),
    item(3, 'AK-47 | Slate (Field-Tested)', { datePurchased: '2026-10-01' }),
  ];
  const r = matchOutgoing({ assetid: '42', marketHashName: 'AK-47 | Slate (Field-Tested)' }, items);
  expect(r.exact).toBeNull();
  expect(r.candidates.map((c) => c.id)).toEqual([3, 2, 1]);
  expect(r.candidates[0].matchType).toBe('name');
});

test('falls back to near names when no name matches', () => {
  const items = [item(1, 'AK-47 | Slate (Field-Tested)'), item(2, 'M4A1-S | Printstream (Minimal Wear)')];
  const r = matchOutgoing({ assetid: '42', marketHashName: 'StatTrak™ AK-47 | Slate (Field-Tested)' }, items);
  expect(r.candidates.every((c) => c.matchType === 'fuzzy')).toBe(true);
  expect(r.candidates.map((c) => c.id)).not.toContain(2);
});
