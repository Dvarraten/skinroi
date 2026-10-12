// Quick integration test for the snipes API modules.
// Usage: node --env-file=.env.local scripts/test-snipes.mjs
//
// Calls CSFloat + DMarket directly and prints real response shape so we can
// verify the code's field expectations against the live APIs.

import { fetchCsfloatListings } from '../api/_lib/snipes/csfloat.js';
import { fetchDmarketListings } from '../api/_lib/snipes/dmarket.js';
import { normalizePhase, needsPhase } from '../api/_lib/snipes/normalize.js';

const MIN = 500; // $5 floor so we see real items

async function run() {
  console.log('=== CSFloat ===');
  try {
    const rows = await fetchCsfloatListings({ minPriceCents: MIN });
    console.log('count:', rows.length);
    if (rows.length) {
      console.log('first item (raw shape):', JSON.stringify(rows[0], null, 2));
      const doppler = rows.find((r) => needsPhase(r.name));
      if (doppler) {
        console.log('\nDoppler example:', JSON.stringify(doppler, null, 2));
      } else {
        console.log('\n(no Doppler in first page)');
      }
    }
  } catch (e) {
    console.error('CSFloat error:', e.message);
  }

  console.log('\n=== DMarket (no auth) ===');
  try {
    const rows = await fetchDmarketListings({ minPriceCents: MIN });
    console.log('count:', rows.length);
    if (rows.length) {
      console.log('first item (raw shape):', JSON.stringify(rows[0], null, 2));
      const doppler = rows.find((r) => needsPhase(r.name));
      if (doppler) {
        console.log('\nDoppler example:', JSON.stringify(doppler, null, 2));
      } else {
        console.log('\n(no Doppler in first page — fetching raw to inspect extra.phase)');
      }
    }
  } catch (e) {
    console.error('DMarket error:', e.message);
  }

  // Also fetch a raw DMarket page without the toListing transform so we can
  // see the actual extra object shape for any Doppler item.
  console.log('\n=== DMarket raw extra object for Dopplers ===');
  try {
    const params = new URLSearchParams({
      gameId: 'a8db',
      currency: 'USD',
      limit: '100',
      orderBy: 'updated',
      orderDir: 'desc',
      priceFrom: String(MIN),
      title: 'Doppler',
    });
    const res = await fetch(`https://api.dmarket.com/exchange/v1/market/items?${params}`);
    const json = await res.json();
    const items = json?.objects || [];
    console.log('raw Doppler count:', items.length);
    for (const o of items.slice(0, 3)) {
      console.log(`\n  title: ${o.title}`);
      console.log(`  extra:`, JSON.stringify(o.extra || {}, null, 4));
      console.log(`  phase (raw):`, o.extra?.phase);
      console.log(`  phase (normalized):`, normalizePhase(o.extra?.phase));
    }
    if (items.length === 0) console.log('(no Doppler items returned with title filter)');
  } catch (e) {
    console.error('DMarket raw error:', e.message);
  }
}

run().catch(console.error);
