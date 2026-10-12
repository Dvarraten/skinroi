import { planCsfloatAutoSync, addPayloadFor } from './csfloatAutoSync';

const knife = { itemName: '★ Karambit | Case Hardened (Field-Tested)', floatValue: 0.2512, paintSeed: 387 };

describe('planCsfloatAutoSync', () => {
  test('adds incoming CSFloat purchases and skips entries without a price', () => {
    const pending = [
      { type: 'incoming', assetid: '1', marketHashName: 'AK-47 | Redline', csfloatPrice: 12.5 },
      { type: 'incoming', assetid: '2', marketHashName: 'AK-47 | Redline' },
    ];
    const { adds, sells } = planCsfloatAutoSync(pending, []);
    expect(adds.map((e) => e.assetid)).toEqual(['1']);
    expect(sells).toEqual([]);
  });

  test('does not add an incoming item already in the portfolio', () => {
    const pending = [{ type: 'incoming', assetid: '1', marketHashName: 'X', csfloatPrice: 5 }];
    const items = [{ id: 10, itemName: 'X', assetid: '1', sold: false }];
    expect(planCsfloatAutoSync(pending, items).adds).toEqual([]);
  });

  test('sells the item with the same assetid', () => {
    const pending = [{ type: 'outgoing', assetid: '55', marketHashName: knife.itemName, csfloatPrice: 900 }];
    const items = [
      { id: 1, ...knife, assetid: '54', sold: false },
      { id: 2, ...knife, assetid: '55', sold: false },
    ];
    expect(planCsfloatAutoSync(pending, items).sells).toEqual([{ entry: pending[0], itemId: 2 }]);
  });

  test('falls back to exact name + float + seed for items without an assetid', () => {
    const pending = [{ type: 'outgoing', assetid: '55', marketHashName: knife.itemName, floatValue: 0.2512, paintSeed: 387, csfloatPrice: 900 }];
    const items = [
      { id: 1, ...knife, paintSeed: 661, sold: false },
      { id: 2, ...knife, sold: false },
    ];
    expect(planCsfloatAutoSync(pending, items).sells).toEqual([{ entry: pending[0], itemId: 2 }]);
  });

  test('never sells a different pattern of the same skin', () => {
    const pending = [{ type: 'outgoing', assetid: '55', marketHashName: knife.itemName, floatValue: 0.2512, paintSeed: 661, csfloatPrice: 900 }];
    const items = [{ id: 1, ...knife, sold: false }];
    expect(planCsfloatAutoSync(pending, items).sells).toEqual([]);
  });

  test('leaves items without float data and without assetid for the user', () => {
    const pending = [{ type: 'outgoing', assetid: '9', marketHashName: 'Revolution Case', csfloatPrice: 0.5 }];
    const items = [{ id: 1, itemName: 'Revolution Case', sold: false }];
    expect(planCsfloatAutoSync(pending, items).sells).toEqual([]);
  });

  test('skips ambiguous matches, sold items and already handled entries', () => {
    const entry = { type: 'outgoing', assetid: '55', marketHashName: knife.itemName, floatValue: 0.2512, paintSeed: 387, csfloatPrice: 900 };
    const twoCopies = [{ id: 1, ...knife, sold: false }, { id: 2, ...knife, sold: false }];
    expect(planCsfloatAutoSync([entry], twoCopies).sells).toEqual([]);
    expect(planCsfloatAutoSync([entry], [{ id: 1, ...knife, sold: true }]).sells).toEqual([]);
    expect(planCsfloatAutoSync([entry], [{ id: 1, ...knife, sold: false }], new Set(['outgoing:55'])).sells).toEqual([]);
  });
});

test('addPayloadFor builds a CSFloat purchase with the assetid', () => {
  const p = addPayloadFor({ assetid: '7', marketHashName: 'AWP | Asiimov', csfloatPrice: 80.06, iconUrl: 'abc', detectedAt: '2026-10-12T10:00:00Z', floatValue: 0.3 });
  expect(p).toMatchObject({
    itemName: 'AWP | Asiimov',
    purchasePrice: 80.06,
    platform: 'csfloat',
    assetid: '7',
    floatValue: 0.3,
    acquiredAt: Date.parse('2026-10-12T10:00:00Z'),
  });
  expect(p.iconUrl).toMatch(/abc\/96fx96f$/);
});
