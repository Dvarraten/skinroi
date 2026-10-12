// DMarket — most recently updated CS2 offers. Prices are USD cents (strings).
// Docs: https://docs.dmarket.com/v1/swagger.html
//
// The market listing is readable without a key in practice, but the docs list
// auth on every route. If DMARKET_PUBLIC_KEY + DMARKET_SECRET_KEY are set we
// sign the request (Ed25519, "dmar ed25519" scheme) so it keeps working if
// DMarket starts enforcing it.

import crypto from 'node:crypto';
import { fetchJson, normalizePhase, toMillis, toNumber } from './normalize.js';

const API = 'https://api.dmarket.com';
const CS2_GAME_ID = 'a8db';
// PKCS#8 DER prefix for a raw 32-byte Ed25519 seed.
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export async function fetchDmarketListings({ minPriceCents }) {
  const params = new URLSearchParams({
    gameId: CS2_GAME_ID,
    currency: 'USD',
    limit: '100',
    orderBy: 'updated',
    orderDir: 'desc',
    priceFrom: String(minPriceCents),
  });
  const path = `/exchange/v1/market/items?${params}`;
  const json = await fetchJson(API + path, { headers: signHeaders('GET', path) });
  return (json?.objects || [])
    .filter((o) => o?.title && toNumber(o?.price?.USD) > 0)
    .map(toListing);
}

function signHeaders(method, pathWithQuery, body = '') {
  const pub = process.env.DMARKET_PUBLIC_KEY;
  const secret = process.env.DMARKET_SECRET_KEY;
  if (!pub || !secret) return {};
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // DMarket secret keys are hex: 32-byte seed followed by the 32-byte public key.
  const seed = Buffer.from(secret, 'hex').subarray(0, 32);
  const key = crypto.createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });
  const signature = crypto.sign(null, Buffer.from(method + pathWithQuery + body + timestamp), key);
  return {
    'X-Api-Key': pub,
    'X-Sign-Date': timestamp,
    'X-Request-Sign': `dmar ed25519 ${signature.toString('hex')}`,
  };
}

function toListing(o) {
  const extra = o.extra || {};
  const stickers = (extra.stickers || []).map((s) => ({ name: s.name, priceUsd: null }));
  return {
    id: `dmarket:${o.itemId}`,
    market: 'dmarket',
    listingId: o.itemId,
    name: o.title,
    phase: normalizePhase(extra.phase),
    priceUsd: toNumber(o.price.USD) / 100,
    float: toNumber(extra.floatValue),
    paintSeed: extra.paintSeed ?? null,
    stickers,
    stickerValueUsd: 0,
    tradeLocked: toNumber(extra.tradeLock) > 0,
    image: o.image || null,
    url: `https://dmarket.com/ingame-items/item-list/csgo-skins?title=${encodeURIComponent(o.title)}`,
    listedAt: toMillis(o.createdAt),
    marketInfo: {},
  };
}
