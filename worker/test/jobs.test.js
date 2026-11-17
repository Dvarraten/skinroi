import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../src/config.js';
import { dueNames, runSellPrices } from '../src/sellprices.js';
import { runSnipes } from '../src/snipes.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('parseEnv handles comments, quotes and CRLF', () => {
  assert.deepEqual(parseEnv('# c\r\nA=1\r\nB="x y"\r\n\r\nC = z\n'), { A: '1', B: 'x y', C: 'z' });
});

test('snipes pushes the feed, then at most 2 lookups', async () => {
  const paths = [];
  const pushes = [];
  const csfetch = async (p) => { paths.push(p); return json({ data: [{ id: p }] }); };
  const skinroi = {
    pushSnipeListings: async (rows) => { pushes.push(['listings', rows.length]); return { matched: 1, csfloatLookups: ['A', 'B', 'C'] }; },
    pushCsfloatLowest: async (lowest) => { pushes.push(['lowest', lowest.map((l) => l.name)]); },
  };
  const out = await runSnipes({ csfetch, skinroi });
  assert.equal(paths.length, 3);
  assert.match(paths[1], /market_hash_name=A/);
  assert.deepEqual(pushes, [['listings', 1], ['lowest', ['A', 'B']]]);
  assert.equal(out.error, null);
});

test('dueNames: missing first, then oldest, max 3', () => {
  const now = 10 * 24 * 3600e3;
  const prices = { a: { csfloat: { at: now - 50 * 3600e3 } }, b: { csfloat: { at: now - 1000 } }, c: { csfloat: { at: now - 60 * 3600e3 } } };
  assert.deepEqual(dueNames(['a', 'b', 'c', 'd', 'e'], prices, 'csfloat', now), ['d', 'e', 'c']);
});

test('sell prices: Doppler phase uses paint_index and pushes cents → USD', async () => {
  const paths = [];
  const csfetch = async (p) => {
    paths.push(p);
    return json([{ price: 12345, item: { market_hash_name: '★ Karambit | Doppler (Factory New)', paint_index: 419 } }]);
  };
  let pushed;
  const skinroi = {
    getSellPriceState: async () => ({ targets: [{ key: 'k|p2', name: '★ Karambit | Doppler (Factory New)', phase: 'Phase 2' }], prices: {} }),
    pushSellPrices: async (b) => { pushed = b; },
  };
  await runSellPrices({ csfetch, skinroi });
  assert.match(paths[0], /paint_index=419/);
  assert.deepEqual(pushed.results, [{ name: 'k|p2', market: 'csfloat', priceUsd: 123.45 }]);
});
