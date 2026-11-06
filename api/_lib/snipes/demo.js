// Delayed snipes for the logged-out demo (GET /api/snipes?demo=1).
// By the time a deal shows up here it is usually gone, which is the point:
// visitors see what the page finds, signed-in users get it in real time.

export const DEMO_DELAY_MS = 15 * 60 * 1000;
const DEMO_MAX_DEALS = 40;

// Rough gap to the best other market, before fees; only used to pick which
// deals the preview keeps. The page does the real math.
function discount(d) {
  const best = Math.max(0, ...Object.values(d.refs || {}).map((r) => Number(r?.priceUsd) || 0));
  return d.priceUsd > 0 ? best / d.priceUsd - 1 : 0;
}

// Deals first seen at least DEMO_DELAY_MS ago, biggest gap first, without
// buy links.
export function demoDeals(deals, now = Date.now()) {
  return (Array.isArray(deals) ? deals : [])
    .filter((d) => d && typeof d.seenAt === 'number' && now - d.seenAt >= DEMO_DELAY_MS)
    .sort((a, b) => discount(b) - discount(a))
    .slice(0, DEMO_MAX_DEALS)
    .map(({ url, listingId, ...rest }) => rest); // eslint-disable-line no-unused-vars
}
