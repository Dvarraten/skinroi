// Per-user marketplace connections: the API keys a user links on the
// Connections page so their trades come in with prices.
//
// Credentials are checked against the marketplace before they are saved,
// encrypted with secret-box.js and stored in `skinroi:conn:{steamId}`. They
// never leave the server again: the browser only ever sees status, a short
// hint ("…a1b2") and when the key was added.
//
// Routes (on /api/items?connections=1, because the Hobby plan allows 12
// functions):
//   GET                         → { connections: { [provider]: status } }
//   POST { provider, fields }   → checks the key, saves it, returns its status
//   DELETE ?provider=…          → forgets the key

import { getRedis } from './redis.js';
import { getSessionSteamId } from './auth.js';
import { seal, open } from './secret-box.js';

const KEY = (steamId) => `skinroi:conn:${steamId}`;
// Who the server's own CSFLOAT_API_KEY belongs to, so its owner sees CSFloat
// as connected without pasting the key again.
const ENV_OWNER_KEY = 'skinroi:conn:csfloat-env-owner';
const ENV_OWNER_TTL_S = 24 * 60 * 60;
const FIELD_MAX = 512;

class KeyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function fetchWithTimeout(url, init = {}, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    throw new KeyError(
      err.name === 'AbortError' ? 'The marketplace took too long to answer. Try again.' : 'Could not reach the marketplace. Try again.',
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

// Steam ID of the account behind a CSFloat API key.
async function csfloatSteamId(apiKey) {
  const resp = await fetchWithTimeout('https://csfloat.com/api/v1/me', {
    headers: { Authorization: apiKey, Accept: 'application/json' },
  });
  if (resp.status === 401 || resp.status === 403) throw new KeyError('CSFloat did not accept this key.');
  if (resp.status === 429) throw new KeyError('CSFloat is rate limiting right now. Try again in a few minutes.', 429);
  if (!resp.ok) throw new KeyError(`CSFloat answered HTTP ${resp.status}. Try again later.`, 502);
  const json = await resp.json().catch(() => null);
  const id = json?.user?.steam_id ?? json?.steam_id;
  if (!id) throw new KeyError('CSFloat answered, but without an account. Check the key.', 502);
  return String(id);
}

// What each marketplace needs and how a key is checked. `verify` throws a
// KeyError with a message the user can act on.
export const PROVIDERS = {
  csfloat: {
    fields: ['apiKey'],
    async verify({ apiKey }, steamId) {
      const owner = await csfloatSteamId(apiKey);
      if (owner !== steamId) {
        throw new KeyError('This key belongs to another Steam account than the one you are signed in with.');
      }
    },
  },
  skinport: {
    fields: ['clientId', 'clientSecret'],
    async verify({ clientId, clientSecret }) {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const resp = await fetchWithTimeout('https://api.skinport.com/v1/account/transactions?limit=1', {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json', 'Accept-Encoding': 'br' },
      });
      if (resp.status === 401 || resp.status === 403) throw new KeyError('Skinport did not accept this Client ID and secret.');
      if (resp.status === 429) throw new KeyError('Skinport is rate limiting right now. Try again in a few minutes.', 429);
      if (!resp.ok) throw new KeyError(`Skinport answered HTTP ${resp.status}. Try again later.`, 502);
    },
  },
};

function hintFor(value) {
  const s = String(value || '');
  return s.length >= 8 ? `…${s.slice(-4)}` : '';
}

async function loadRecord(steamId) {
  const raw = await getRedis().get(KEY(steamId));
  if (!raw) return {};
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function saveRecord(steamId, record) {
  const redis = getRedis();
  if (Object.keys(record).length === 0) await redis.del(KEY(steamId));
  else await redis.set(KEY(steamId), record);
}

// Decrypted credentials for one provider, or null. Never throws.
export async function getCredentials(steamId, provider) {
  if (!steamId) return null;
  try {
    const entry = (await loadRecord(steamId))[provider];
    return entry?.sealed ? open(entry.sealed, steamId) : null;
  } catch (err) {
    console.warn(`[connections] read ${provider} failed:`, err.message || err);
    return null;
  }
}

// Called by importers when a marketplace rejects a stored key, so the page
// can ask the user to reconnect.
export async function markConnectionError(steamId, provider, message) {
  try {
    const record = await loadRecord(steamId);
    if (!record[provider]) return;
    record[provider] = { ...record[provider], status: 'error', lastError: message, checkedAt: Date.now() };
    await saveRecord(steamId, record);
  } catch (err) {
    console.warn(`[connections] mark ${provider} failed:`, err.message || err);
  }
}

// Whether the server's CSFLOAT_API_KEY belongs to `steamId` (cached a day).
async function isEnvCsfloatOwner(steamId) {
  const apiKey = process.env.CSFLOAT_API_KEY;
  if (!apiKey) return false;
  const redis = getRedis();
  try {
    let owner = await redis.get(ENV_OWNER_KEY);
    if (!owner) {
      try {
        owner = await csfloatSteamId(apiKey);
        await redis.set(ENV_OWNER_KEY, owner, { ex: ENV_OWNER_TTL_S });
      } catch {
        // Don't ask CSFloat again on every page open while it fails.
        await redis.set(ENV_OWNER_KEY, '-', { ex: 60 * 60 });
        return false;
      }
    }
    return String(owner) === steamId;
  } catch {
    return false;
  }
}

async function publicStatus(steamId) {
  const record = await loadRecord(steamId);
  const out = {};
  for (const id of Object.keys(PROVIDERS)) {
    const e = record[id];
    if (e?.sealed) {
      // A key sealed with an older secret can't be opened any more.
      const readable = open(e.sealed, steamId) != null;
      out[id] = {
        connected: true,
        status: readable ? e.status || 'ok' : 'error',
        lastError: readable ? e.lastError || null : 'Saved key could not be read. Connect again.',
        hint: e.hint || '',
        addedAt: e.addedAt || null,
        checkedAt: e.checkedAt || null,
      };
    } else {
      out[id] = { connected: false };
    }
  }
  if (!out.csfloat.connected && (await isEnvCsfloatOwner(steamId))) {
    out.csfloat = { connected: true, status: 'ok', viaServer: true, hint: '', addedAt: null, checkedAt: null };
  }
  return out;
}

// Caches built from an old key must not outlive it.
async function clearProviderCaches(steamId, provider) {
  if (provider !== 'csfloat') return;
  try {
    await getRedis().del(`skinroi:csfloat:trades:${steamId}`, `skinroi:csfloat:trades-fail:${steamId}`);
  } catch {
    // Best effort; the caches expire in minutes anyway.
  }
}

export async function handleConnections(req, res) {
  const steamId = getSessionSteamId(req);
  if (!steamId) return res.status(401).json({ error: 'not authenticated' });
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      return res.json({ connections: await publicStatus(steamId) });
    }

    if (req.method === 'POST') {
      const { provider, fields } = req.body || {};
      const def = PROVIDERS[provider];
      if (!def) return res.status(400).json({ error: 'Unknown marketplace' });

      const clean = {};
      for (const name of def.fields) {
        const v = typeof fields?.[name] === 'string' ? fields[name].trim() : '';
        if (!v) return res.status(400).json({ error: 'Fill in every field.' });
        if (v.length > FIELD_MAX) return res.status(400).json({ error: 'That value is too long to be a key.' });
        clean[name] = v;
      }

      await def.verify(clean, steamId);

      const record = await loadRecord(steamId);
      const now = Date.now();
      record[provider] = {
        sealed: seal(clean, steamId),
        hint: hintFor(clean[def.fields[def.fields.length - 1]]),
        addedAt: now,
        checkedAt: now,
        status: 'ok',
        lastError: null,
      };
      await saveRecord(steamId, record);
      await clearProviderCaches(steamId, provider);
      return res.json({ connections: await publicStatus(steamId) });
    }

    if (req.method === 'DELETE') {
      const provider = req.query?.provider;
      if (!PROVIDERS[provider]) return res.status(400).json({ error: 'Unknown marketplace' });
      const record = await loadRecord(steamId);
      delete record[provider];
      await saveRecord(steamId, record);
      await clearProviderCaches(steamId, provider);
      return res.json({ connections: await publicStatus(steamId) });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    if (err instanceof KeyError) return res.status(err.status).json({ error: err.message });
    console.error('[connections] failed:', err.message || err);
    return res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
  }
}
