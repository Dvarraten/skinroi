// Persistence layer for the browser extension flow.
//
// The extension is the sole source of Steam trade data. A user pairs their
// extension to their SkinROI account via a one-time code, and receives a
// long-lived secret used to authenticate all future trade pushes.
//
// Redis keys:
//   skinroi:ext-pair:{code}       Short-lived pairing code (TTL 10 min).
//   skinroi:ext-secret:{secret}   Reverse lookup: secret → steamId (no TTL).
//   skinroi:ext-info:{steamId}    Extension connection info per user.

import { randomBytes, randomInt } from 'crypto';
import { getRedis } from './redis.js';

const PAIR_KEY = (code) => `skinroi:ext-pair:${code}`;
const SECRET_KEY = (secret) => `skinroi:ext-secret:${secret}`;
const INFO_KEY = (steamId) => `skinroi:ext-info:${steamId}`;

const PAIR_TTL_S = 10 * 60;
// Warm instances remember a resolved secret this long, so the extension's
// several pushes per poll don't each cost a Redis read. A revoked secret can
// keep working on a warm instance for at most this long.
const SECRET_CACHE_MS = 5 * 60 * 1000;
// lastSeen is only rewritten after this long (it's shown as "last push 3 min
// ago"), so a push every 2 min doesn't rewrite ext-info every time.
const LAST_SEEN_WRITE_MS = 10 * 60 * 1000;
const secretCache = new Map();

// Ambiguous chars (0, O, 1, I, L) are excluded so hand-typed codes are hard
// to misread. Split "ABCDEFGH" → "ABCD-EFGH" for extra readability.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generatePairingCode() {
  let raw = '';
  for (let i = 0; i < 8; i++) raw += ALPHABET[randomInt(0, ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function generateSecret() {
  return randomBytes(32).toString('hex');
}

export async function savePairing(code, steamId) {
  const client = getRedis();
  const payload = { steamId, createdAt: Date.now(), claimed: false, extVersion: null };
  await client.set(PAIR_KEY(code), payload, { ex: PAIR_TTL_S });
  return { code, expiresAt: Date.now() + PAIR_TTL_S * 1000 };
}

export async function loadPairing(code) {
  if (!code || typeof code !== 'string') return null;
  const client = getRedis();
  const raw = await client.get(PAIR_KEY(code));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// Atomically mark a pairing as claimed by the extension. Returns { ok: true,
// steamId } on success, or { ok: false, reason } if the code was invalid,
// expired, or already claimed.
export async function claimPairing(code, extVersion) {
  const pairing = await loadPairing(code);
  if (!pairing) return { ok: false, reason: 'invalid_or_expired' };
  if (pairing.claimed) return { ok: false, reason: 'already_claimed' };

  const client = getRedis();
  const secret = generateSecret();
  const steamId = pairing.steamId;
  const now = Date.now();

  await client.set(PAIR_KEY(code), {
    ...pairing,
    claimed: true,
    claimedAt: now,
    extVersion: extVersion || null,
  }, { ex: PAIR_TTL_S });

  await client.set(SECRET_KEY(secret), steamId);
  await client.set(INFO_KEY(steamId), {
    secret,
    extVersion: extVersion || null,
    pairedAt: now,
    lastSeen: null,
  });

  return { ok: true, steamId, secret };
}

export async function loadExtensionInfo(steamId) {
  if (!steamId) return null;
  const client = getRedis();
  const raw = await client.get(INFO_KEY(steamId));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// Resolve a Bearer secret back to a Steam ID. Used to authenticate all
// extension-originated API calls (trades push, heartbeat).
export async function resolveSecret(secret) {
  if (!secret || typeof secret !== 'string') return null;
  const hit = secretCache.get(secret);
  if (hit && Date.now() - hit.at < SECRET_CACHE_MS) return hit.steamId;
  const client = getRedis();
  const raw = await client.get(SECRET_KEY(secret));
  const steamId = raw ? String(raw) : null;
  if (steamId) secretCache.set(secret, { steamId, at: Date.now() });
  else secretCache.delete(secret);
  return steamId;
}

// info: the ext-info the caller already loaded (saves a read). Skips the
// write when lastSeen is recent and the version is unchanged.
export async function touchLastSeen(steamId, extVersion = null, info = undefined) {
  if (info === undefined) info = await loadExtensionInfo(steamId);
  if (!info) return;
  const version = extVersion || info.extVersion || null;
  if (info.lastSeen && Date.now() - info.lastSeen < LAST_SEEN_WRITE_MS && version === info.extVersion) return;
  const client = getRedis();
  await client.set(INFO_KEY(steamId), {
    ...info,
    lastSeen: Date.now(),
    extVersion: extVersion || info.extVersion || null,
  });
}

// Revoke: remove the secret and the info blob so the extension is fully
// disconnected. The extension will discover this on its next push (401) and
// wipe its local state.
export async function revokeExtension(steamId) {
  const info = await loadExtensionInfo(steamId);
  if (!info) return { revoked: false };
  secretCache.delete(info.secret);
  const client = getRedis();
  await Promise.all([
    client.del(SECRET_KEY(info.secret)),
    client.del(INFO_KEY(steamId)),
  ]);
  return { revoked: true };
}

// Extract Bearer token from Authorization header. Returns null if missing.
export function extractBearer(req) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || typeof auth !== 'string') return null;
  const [scheme, token] = auth.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}
