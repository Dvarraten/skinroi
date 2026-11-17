// One gate for every CSFloat call the worker makes. Same rules as
// extension/src/lib/csfloat.js (read that file for the reasoning):
//   - calls run one at a time, CSFLOAT_MIN_GAP_MS apart;
//   - a 429 (or X-RateLimit-Remaining: 0) pauses every call until
//     Retry-After / X-RateLimit-Reset, else 10 min doubling to 60 min;
//   - the last call time and the pause are saved to disk, so restarting the
//     worker never resets the budget.
// Never add a CSFloat call that doesn't go through gate.fetch().

import { CSFLOAT_MIN_GAP_MS, CSFLOAT_PAUSE_MAX_MS, CSFLOAT_PAUSE_MIN_MS } from './config.js';

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class CsfloatPausedError extends Error {
  constructor(until, now = Date.now()) {
    const mins = Math.max(1, Math.ceil((until - now) / 60000));
    super(`CSFloat rate limited, paused ${mins} min`);
    this.until = until;
  }
}

// When a rate-limited response says CSFloat takes calls again (ms epoch), or null.
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

// Pause after the n-th 429 in a row when CSFloat doesn't say: 10, 20, 40, 60 min.
export function fallbackPauseMs(strikes) {
  return Math.min(CSFLOAT_PAUSE_MIN_MS * 2 ** Math.max(0, strikes - 1), CSFLOAT_PAUSE_MAX_MS);
}

// store: { read(), write(obj) }. doFetch(url) → Response-like (status, ok, headers).
export function createGate({ store, doFetch, now = Date.now, sleep = realSleep, gapMs = CSFLOAT_MIN_GAP_MS }) {
  let queue = Promise.resolve();
  const patch = (p) => {
    const next = { ...store.read(), ...p };
    store.write(next);
    return next;
  };

  async function gated(url) {
    let state = store.read();
    if (state.pausedUntil > now()) throw new CsfloatPausedError(state.pausedUntil, now());

    const wait = (state.lastCallAt || 0) + gapMs - now();
    if (wait > 0) await sleep(Math.min(wait, gapMs));
    state = patch({ lastCallAt: now() });

    const res = await doFetch(url);
    const t = now();

    if (res.status === 429) {
      const strikes = (state.strikes || 0) + 1;
      const until = resumeTimeFrom(res.headers, t) ?? t + fallbackPauseMs(strikes);
      const pausedUntil = Math.min(Math.max(until, t + 60 * 1000), t + CSFLOAT_PAUSE_MAX_MS);
      patch({ pausedUntil, strikes });
      throw new CsfloatPausedError(pausedUntil, t);
    }

    const p = {};
    if (res.ok && state.strikes) p.strikes = 0;
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      const until = resumeTimeFrom(res.headers, t);
      if (until && until > t) p.pausedUntil = Math.min(until, t + CSFLOAT_PAUSE_MAX_MS);
    }
    if (Object.keys(p).length) patch(p);
    return res;
  }

  return {
    fetch(url) {
      const run = queue.then(() => gated(url));
      queue = run.catch(() => {});
      return run;
    },
    // A page load on csfloat.com also makes CSFloat calls: count it as one.
    async markCall() {
      const run = queue.then(async () => {
        const wait = (store.read().lastCallAt || 0) + gapMs - now();
        if (wait > 0) await sleep(Math.min(wait, gapMs));
        patch({ lastCallAt: now() });
      });
      queue = run.catch(() => {});
      return run;
    },
    pausedUntil() {
      const { pausedUntil = 0 } = store.read();
      return pausedUntil > now() ? pausedUntil : 0;
    },
  };
}
