// Snipes: newest CSFloat buy-now listings → SkinROI, then the cheapest
// listings of the few items the server asks about. Port of runSnipes() in
// extension/src/background.js and extension/src/lib/snipelookups.js.

import { SNIPE_LOOKUPS_PER_RUN, csfloatListingsFeedPath, csfloatListingsPath } from './config.js';

const rowsOf = (json) => (Array.isArray(json) ? json : json?.data || []);

// csfetch(path) goes through the gate. Returns a short summary for the log.
export async function runSnipes({ csfetch, skinroi }) {
  const res = await csfetch(csfloatListingsFeedPath);
  if (!res.ok) throw new Error(`CSFloat listings HTTP ${res.status}`);
  const rows = rowsOf(await res.json());
  const pushed = await skinroi.pushSnipeListings(rows);

  const names = (Array.isArray(pushed?.csfloatLookups) ? pushed.csfloatLookups : [])
    .filter((n) => typeof n === 'string')
    .slice(0, SNIPE_LOOKUPS_PER_RUN);
  const lowest = [];
  let lookupError = null;
  for (const name of names) {
    const params = new URLSearchParams({ market_hash_name: name, sort_by: 'lowest_price', type: 'buy_now', limit: '3' });
    try {
      const r = await csfetch(`${csfloatListingsPath}?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      lowest.push({ name, rows: rowsOf(await r.json()) });
    } catch (err) {
      // Rate limited or signed out: the server asks again next round.
      lookupError = `lookup: ${err.message || err}`;
      break;
    }
  }
  if (lowest.length) await skinroi.pushCsfloatLowest(lowest);

  return {
    summary: `snipes: ${rows.length} listings, ${pushed?.matched ?? '?'} deals, ${lowest.length}/${names.length} lookups`,
    error: lookupError,
  };
}
