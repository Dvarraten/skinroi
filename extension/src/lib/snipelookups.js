// Snipes: CSFloat's sell price for an item is its cheapest CSFloat listing.
// After each push of new CSFloat listings the backend names a few items whose
// cheapest listing it doesn't know yet (most promising first). They are looked
// up here, from the user's own IP, gently spaced, and pushed back.

import { CSFLOAT_LISTINGS_API, SNIPE_LOOKUP_GAP_MS } from './config.js';
import { pushCsfloatLowest } from './skinroi.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Returns an error message for the activity log, or null.
export async function runSnipeLookups(names) {
  const lookups = (Array.isArray(names) ? names : []).filter((n) => typeof n === 'string').slice(0, 10);
  if (!lookups.length) return null;

  const lowest = [];
  let error = null;
  for (let i = 0; i < lookups.length; i++) {
    if (i > 0) await sleep(SNIPE_LOOKUP_GAP_MS);
    const params = new URLSearchParams({
      market_hash_name: lookups[i],
      sort_by: 'lowest_price',
      type: 'buy_now',
      limit: '3',
    });
    try {
      const res = await fetch(`${CSFLOAT_LISTINGS_API}?${params}`, { credentials: 'include' });
      // Rate limited or signed out: stop for this round, the backend asks again later.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      lowest.push({ name: lookups[i], rows: Array.isArray(json) ? json : json?.data || [] });
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
