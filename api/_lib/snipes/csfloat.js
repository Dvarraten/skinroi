// CSFloat — newest buy-now listings, normalized for the scanner. Prices are
// USD cents. The listings are fetched by the SkinROI browser extension and
// pushed to POST /api/snipes: CSFloat answers 429 ("too many requests from
// too many IPs") when the server fetches them, because Vercel functions call
// out from many different IPs. The extension runs on the user's one IP.

import { normalizePhase, toMillis } from './normalize.js';

const STEAM_IMG = 'https://community.cloudflare.steamstatic.com/economy/image/';

// rows: raw listing objects from GET csfloat.com/api/v1/listings.
export function normalizeCsfloatListings(rows, { minPriceCents = 0 } = {}) {
  return (Array.isArray(rows) ? rows : [])
    .filter((l) => l?.id && l?.item?.market_hash_name && l.price >= Math.max(minPriceCents, 1))
    .map(toListing);
}

function toListing(l) {
  const item = l.item;
  const stickers = [...(item.stickers || []), ...(item.keychains || [])].map((s) => ({
    name: s.name,
    priceUsd: s.reference?.price ? s.reference.price / 100 : null,
  }));
  return {
    id: `csfloat:${l.id}`,
    market: 'csfloat',
    listingId: l.id,
    name: item.market_hash_name,
    phase: normalizePhase(item.phase),
    priceUsd: l.price / 100,
    float: item.float_value ?? null,
    paintSeed: item.paint_seed ?? null,
    stickers,
    stickerValueUsd: stickers.reduce((s, x) => s + (x.priceUsd || 0), 0),
    tradeLocked: false,
    image: item.icon_url ? STEAM_IMG + item.icon_url : null,
    url: `https://csfloat.com/item/${l.id}`,
    listedAt: toMillis(l.created_at),
    marketInfo: {
      // Steam Community Market daily volume and CSFloat's own listing count:
      // both are useful secondary liquidity signals.
      steamVolume: item.scm?.volume ?? null,
      quantity: l.reference?.quantity ?? null,
    },
  };
}
