// HTTP client for the SkinROI backend. All calls go through here so retries,
// auth, and error handling are consistent.

import { EXT_VERSION } from './config.js';
import { getPairing, clearPairing } from './storage.js';

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

  if (res.status === 401 && auth) {
    // Secret was revoked server-side — wipe local pairing so the popup
    // prompts the user to re-pair.
    await clearPairing();
    throw new Error('extension unpaired by server');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function claimCode(code) {
  return request('/api/extension/claim', {
    method: 'POST',
    body: { code, extVersion: EXT_VERSION },
  });
}

// Push a batch of normalized trade offers to the backend. `baseline: true` on
// the first push tells the server to seed processedTradeIds without adding
// pending items — so a freshly paired user doesn't see every historical
// trade flood into Handle Items.
export async function pushOffers({ offers, baseline = false }) {
  const payload = Array.isArray(offers) ? offers : [];
  return request('/api/extension/trades', {
    method: 'POST',
    auth: true,
    body: { offers: payload, baseline: !!baseline, extVersion: EXT_VERSION },
  });
}
