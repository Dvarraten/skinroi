// One gate for every call to csfloat.com/api/v1/listings from the extension
// (Snipes feed, Snipes cheapest-listing lookups, Home sell prices).
//
// CSFloat documents no numbers, only that 429 means "too many requests".
// Community notes (BetterFloat's API wiki) put /v1/listings at 5 requests a
// minute, and CSFloat answers with X-RateLimit-* headers per endpoint. So:
//   - calls are queued and spaced CSFLOAT_MIN_GAP_MS apart (4 a minute), no
//     matter which feature makes them or how many run at once;
//   - a 429 (or Remaining: 0) pauses every CSFloat call until Retry-After /
//     X-RateLimit-Reset, or for a growing pause when neither is sent;
//   - the last call time and the pause live in chrome.storage.local, so they
//     survive the service worker being restarted.

import { CSFLOAT_MIN_GAP_MS, CSFLOAT_PAUSE_MIN_MS, CSFLOAT_PAUSE_MAX_MS } from './config.js';

const STATE_KEY = 'skinroi_csfloatGate';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Thrown instead of calling CSFloat while it is paused, and on a 429.
export class CsfloatPausedError extends Error {
  constructor(until) {
    const mins = Math.max(1, Math.ceil((until - Date.now()) / 60000));
    super(`CSFloat rate limited, paused ${mins} min`);
    this.until = until;
  }
}

async function readState() {
  try {
    const data = await chrome.storage.local.get([STATE_KEY]);
    return data[STATE_KEY] || {};
  } catch {
    return {};
  }
}

async function writeState(patch) {
  const state = { ...(await readState()), ...patch };
  try {
    await chrome.storage.local.set({ [STATE_KEY]: state });
  } catch {
    // Storage failing only loses the spacing across restarts.
  }
  return state;
}

// When a rate-limited response says CSFloat will take calls again (ms epoch),
// or null when it doesn't say.
export function resumeTimeFrom(headers, now) {
  const retryAfter = headers.get('retry-after');
  if (retryAfter != null && retryAfter !== '') {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs)) return now + secs * 1000;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return date;
  }
  const reset = Number(headers.get('x-ratelimit-reset'));
  if (Number.isFinite(reset) && reset > 0) {
    // Epoch seconds; small numbers are "seconds from now".
    return reset > 1e9 ? reset * 1000 : now + reset * 1000;
  }
  return null;
}

// The pause after the n-th 429 in a row when CSFloat doesn't say how long:
// 10 min, 20, 40, then 60 min at most.
export function fallbackPauseMs(strikes) {
  return Math.min(CSFLOAT_PAUSE_MIN_MS * 2 ** Math.max(0, strikes - 1), CSFLOAT_PAUSE_MAX_MS);
}

// Resolves with the ms epoch CSFloat is paused until, or 0.
export async function csfloatPausedUntil() {
  const { pausedUntil = 0 } = await readState();
  return pausedUntil > Date.now() ? pausedUntil : 0;
}

// Calls run one at a time, in order.
let queue = Promise.resolve();

// fetch() for csfloat.com/api/v1/listings. Waits for its turn, throws
// CsfloatPausedError while paused or on a 429, otherwise returns the Response.
export function csfloatFetch(url) {
  const run = queue.then(() => gatedFetch(url));
  queue = run.catch(() => {});
  return run;
}

async function gatedFetch(url) {
  let state = await readState();
  if (state.pausedUntil > Date.now()) throw new CsfloatPausedError(state.pausedUntil);

  const wait = (state.lastCallAt || 0) + CSFLOAT_MIN_GAP_MS - Date.now();
  // Waits stay under the service worker's 30 s idle limit (the gap is 15 s).
  if (wait > 0) await sleep(Math.min(wait, CSFLOAT_MIN_GAP_MS));

  state = await writeState({ lastCallAt: Date.now() });
  if (state.pausedUntil > Date.now()) throw new CsfloatPausedError(state.pausedUntil);

  const res = await fetch(url, { credentials: 'include' });
  const now = Date.now();

  if (res.status === 429) {
    const strikes = (state.strikes || 0) + 1;
    const until = resumeTimeFrom(res.headers, now) ?? now + fallbackPauseMs(strikes);
    // Never shorter than a minute, never longer than the cap.
    const pausedUntil = Math.min(Math.max(until, now + 60 * 1000), now + CSFLOAT_PAUSE_MAX_MS);
    await writeState({ pausedUntil, strikes });
    throw new CsfloatPausedError(pausedUntil);
  }

  const patch = {};
  if (res.ok && state.strikes) patch.strikes = 0;
  // Out of budget for this window: wait for the reset instead of earning a 429.
  if (res.headers.get('x-ratelimit-remaining') === '0') {
    const until = resumeTimeFrom(res.headers, now);
    if (until && until > now) patch.pausedUntil = Math.min(until, now + CSFLOAT_PAUSE_MAX_MS);
  }
  if (Object.keys(patch).length) await writeState(patch);
  return res;
}
