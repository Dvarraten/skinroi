// DMarket — CS2 offers from the marketplace API. Prices are USD cents.
//
// The old /exchange/v1/market/items endpoint now answers 410 Gone and points
// to /marketplace-api/v2/offers. That endpoint isn't in DMarket's public docs
// yet, so the parser below accepts the field layouts seen in the wild
// (flat offer objects, or fields nested under `attributes`). If DMarket
// answers but nothing parses, the error lists the keys we got back so the
// shape can be fixed quickly.
//
// If DMARKET_PUBLIC_KEY + DMARKET_SECRET_KEY are set we sign the request
// (Ed25519, "dmar ed25519" scheme).

import crypto from 'node:crypto';
import { fetchJson, normalizePhase, toMillis, toNumber } from './normalize.js';

const API = 'https://api.dmarket.com';
const OFFERS_PATH = '/marketplace-api/v2/offers';
const CS2_GAME_ID = 'a8db';
// PKCS#8 DER prefix for a raw 32-byte Ed25519 seed.
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export async function fetchDmarketListings({ minPriceCents }) {
  const base = { gameId: CS2_GAME_ID, limit: '100', currency: 'USD' };
  // Newest first when DMarket accepts the sort; some API versions reject
  // unknown params with 400, so fall back to the default order.
  let json;
  try {
    json = await get({ ...base, orderBy: 'updated', orderDir: 'desc' });
  } catch (e) {
    if (e.status !== 400) throw e;
    json = await get(base);
  }

  const rows = json?.offers || json?.objects || json?.items || (Array.isArray(json?.data) ? json.data : []);
  const listings = rows.map(toListing).filter(Boolean);
  if (rows.length && !listings.length) {
    throw new Error(`DMarket answered but no offer could be read. Keys: ${describe(json, rows[0])}`);
  }
  if (!rows.length && json && typeof json === 'object' && !Array.isArray(json) && !('offers' in json)) {
    throw new Error(`DMarket answered without an offers list. Keys: ${describe(json)}`);
  }
  return listings.filter((l) => l.priceUsd * 100 >= minPriceCents);
}

async function get(params) {
  const path = `${OFFERS_PATH}?${new URLSearchParams(params)}`;
  return fetchJson(API + path, { headers: signHeaders('GET', path) });
}

function describe(json, row) {
  const top = Object.keys(json || {}).join(',');
  const inner = row && typeof row === 'object'
    ? ` | offer: ${Object.keys(row).join(',')}${row.attributes ? ` | attributes: ${Object.keys(row.attributes).join(',')}` : ''}`
    : '';
  return `${top}${inner}`;
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

// Price in USD from whichever field this API version uses.
function priceUsd(o, a) {
  const cents = toNumber(o.priceCents ?? a.priceCents ?? o.price?.USD ?? a.price?.USD);
  if (cents) return cents / 100;
  const amount = toNumber(o.price?.amount ?? a.price?.amount);
  return amount || null;
}

function toListing(o) {
  if (!o || typeof o !== 'object') return null;
  const a = o.attributes || {};
  const cs2 = a.cs2 || o.cs2 || o.extra || {};
  const name = a.title || o.title;
  const price = priceUsd(o, a);
  const id = o.offerId || o.id || o.itemId || a.offerId;
  if (!name || !price || !id) return null;

  const unlockAt = toMillis(o.unlockDate || a.unlockDate);
  const tradeLocked =
    o.locked === true ||
    o.tradable === false ||
    toNumber(cs2.tradeLock) > 0 ||
    (unlockAt != null && unlockAt > Date.now());

  return {
    id: `dmarket:${id}`,
    market: 'dmarket',
    listingId: String(id),
    name,
    phase: normalizePhase(cs2.phase || a.phase),
    priceUsd: price,
    float: toNumber(cs2.float ?? cs2.floatValue),
    paintSeed: cs2.paintSeed ?? null,
    stickers: (cs2.stickers || []).map((s) => ({ name: s.name, priceUsd: null })),
    stickerValueUsd: 0,
    tradeLocked,
    image: o.image || a.image || null,
    url: `https://dmarket.com/ingame-items/item-list/csgo-skins?title=${encodeURIComponent(name)}`,
    listedAt: toMillis(o.createdAt || a.createdAt),
    marketInfo: {},
  };
}
