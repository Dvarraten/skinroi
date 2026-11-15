// SkinROI API client. Same endpoints, body shapes and Bearer secret as the
// extension (extension/src/lib/skinroi.js), so the server needs no changes.

import { WORKER_VERSION } from './config.js';

export class NotPairedError extends Error {}

export function createSkinroiClient({ baseUrl, secret, fetchImpl = fetch }) {
  async function request(path, { method = 'GET', body } = {}) {
    if (!secret) throw new NotPairedError('not paired: set SKINROI_SECRET or run `npm run pair -- CODE`');
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 200) }; }
    if (res.status === 401) throw new NotPairedError(data.error || 'HTTP 401 (secret revoked?)');
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return {
    // Raw CSFloat listing rows for Snipes → { checked, matched, csfloatLookups }.
    pushSnipeListings: (listings) =>
      request('/api/snipes', { method: 'POST', body: { market: 'csfloat', listings, extVersion: WORKER_VERSION } }),
    // Cheapest listings for the names the server asked about: [{ name, rows }].
    pushCsfloatLowest: (lowest) =>
      request('/api/snipes', { method: 'POST', body: { market: 'csfloat', lowest, extVersion: WORKER_VERSION } }),
    getSellPriceState: () => request('/api/items?sellPrices=1'),
    pushSellPrices: ({ results, status }) =>
      request('/api/items?sellPrices=1', { method: 'POST', body: { results, status, extVersion: WORKER_VERSION } }),
  };
}

// POST /api/extension/claim with a pairing code from the site's account menu.
export async function claimCode({ baseUrl, code, fetchImpl = fetch }) {
  const res = await fetchImpl(`${baseUrl}/api/extension/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, extVersion: WORKER_VERSION }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data; // { ok, secret, steamId }
}
