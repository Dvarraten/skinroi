// CSFloat — newest buy-now listings. Needs CSFLOAT_API_KEY (profile →
// Developer tab on csfloat.com). Prices are USD cents.
// Docs: https://docs.csfloat.com/

import { fetchJson, normalizePhase, toMillis } from './normalize.js';

const STEAM_IMG = 'https://community.cloudflare.steamstatic.com/economy/image/';

export async function fetchCsfloatListings({ minPriceCents }) {
  const key = process.env.CSFLOAT_API_KEY;
  if (!key) throw new Error('CSFLOAT_API_KEY is not set');

  const params = new URLSearchParams({
    sort_by: 'most_recent',
    type: 'buy_now',
    limit: '50',
    min_price: String(minPriceCents),
  });
  const json = await fetchJson(`https://csfloat.com/api/v1/listings?${params}`, {
    headers: { Authorization: key },
  });
  // The endpoint has returned both a bare array and { data, cursor } over time.
  const rows = Array.isArray(json) ? json : json?.data || [];
  return rows.filter((l) => l?.item?.market_hash_name && l.price > 0).map(toListing);
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
