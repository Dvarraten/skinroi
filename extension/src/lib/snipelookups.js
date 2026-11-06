// Snipes: CSFloat's sell price for an item is its cheapest CSFloat listing.
// After each push of new CSFloat listings the backend names a few items whose
// cheapest listing it doesn't know yet (most promising first). They are looked
// up here, from the user's own IP, through the shared CSFloat gate
// (lib/csfloat.js), and pushed back.

import { CSFLOAT_LISTINGS_API, SNIPE_LOOKUPS_PER_RUN } from './config.js';
import { csfloatFetch } from './csfloat.js';
import { pushCsfloatLowest } from './skinroi.js';

// Returns an error message for the activity log, or null.
export async function runSnipeLookups(names) {
  const lookups = (Array.isArray(names) ? names : [])
    .filter((n) => typeof n === 'string')
    .slice(0, SNIPE_LOOKUPS_PER_RUN);
  if (!lookups.length) return null;

  const lowest = [];
  let error = null;
  for (const name of lookups) {
    const params = new URLSearchParams({
      market_hash_name: name,
      sort_by: 'lowest_price',
      type: 'buy_now',
      limit: '3',
    });
    try {
      const res = await csfloatFetch(`${CSFLOAT_LISTINGS_API}?${params}`);
      // Rate limited or signed out: stop for this round, the backend asks again later.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      lowest.push({ name, rows: Array.isArray(json) ? json : json?.data || [] });
    } catch (err) {
      error = `CSFloat lookup: ${err.message || err}`;
      break;
    }
  }

  if (lowest.length) {
    try {
      await pushCsfloatLowest(lowest);
    } catch (err) {
      return `Snipes lookup push: ${err.message || err}`;
    }
  }
  return error;
}
