// HTTP client for the SkinROI backend. All calls go through here so retries,
// auth, and error handling are consistent.

import { EXT_VERSION } from './config.js';
import { getPairing } from './storage.js';

async function request(path, { method = 'GET', body = null, auth = false } = {}) {
  const { baseUrl, secret } = await getPairing();
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    if (!secret) throw new Error('not paired');
    headers.Authorization = `Bearer ${secret}`;
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    // Historically we wiped local pairing on any 401 to force re-pair.
    // That was too aggressive — a single transient 401 (routing hiccup,
    // Redis eventual consistency, etc.) would silently disconnect the
    // extension. Just surface the error and let the user disconnect
    // manually if the secret is genuinely revoked.
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function claimCode(code) {
  return request('/api/extension/claim', {
    method: 'POST',
    body: { code, extVersion: EXT_VERSION },
  });
}

// Push a batch of normalized trade offers to the backend. The backend applies
// the pairedAt cutoff server-side: trades accepted before pairing are silently
// recorded in processedTradeIds without surfacing in Handle Items.
export async function pushOffers({ offers }) {
  const payload = Array.isArray(offers) ? offers : [];
  return request('/api/extension/trades', {
    method: 'POST',
    auth: true,
    body: { offers: payload, extVersion: EXT_VERSION },
  });
}

// Push raw CSFloat listings for the Snipes tab. The backend normalizes and
// prices them; the extension only forwards what CSFloat returned.
export async function pushSnipeListings(listings) {
  return request('/api/snipes', {
    method: 'POST',
    auth: true,
    body: { market: 'csfloat', listings, extVersion: EXT_VERSION },
  });
}
