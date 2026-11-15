import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CsfloatPausedError, createGate, fallbackPauseMs, resumeTimeFrom } from '../src/gate.js';
import { memoryStore } from '../src/state.js';

function clock(start = 1_700_000_000_000) {
  let t = start;
  return { now: () => t, sleep: async (ms) => { t += ms; }, advance: (ms) => { t += ms; } };
}
const res = (status, headers = {}) => new Response('[]', { status, headers });

test('calls are spaced 18 s apart, in order', async () => {
  const c = clock();
  const times = [];
  const gate = createGate({ store: memoryStore(), now: c.now, sleep: c.sleep, doFetch: async () => { times.push(c.now()); return res(200); } });
  await Promise.all([gate.fetch('a'), gate.fetch('b'), gate.fetch('c')]);
  assert.deepEqual(times.map((t) => t - times[0]), [0, 18_000, 36_000]);
});

test('a 429 with Retry-After pauses every later call', async () => {
  const c = clock();
  let calls = 0;
  const store = memoryStore();
  const gate = createGate({ store, now: c.now, sleep: c.sleep, doFetch: async () => { calls++; return res(429, { 'retry-after': '120' }); } });
  await assert.rejects(gate.fetch('a'), CsfloatPausedError);
  await assert.rejects(gate.fetch('b'), CsfloatPausedError);
  assert.equal(calls, 1);
  assert.equal(gate.pausedUntil(), store.read().lastCallAt + 120_000);
  c.advance(121_000);
  assert.equal(gate.pausedUntil(), 0);
});

test('a 429 without headers backs off 10, 20, 40, 60 min', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(fallbackPauseMs).map((ms) => ms / 60000), [10, 20, 40, 60, 60]);
});

test('Remaining: 0 waits for the reset instead of earning a 429', async () => {
  const c = clock();
  const store = memoryStore();
  const gate = createGate({ store, now: c.now, sleep: c.sleep, doFetch: async () => res(200, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '30' }) });
  await gate.fetch('a');
  assert.ok(gate.pausedUntil() > c.now());
});

test('the pause survives a restart (same store)', async () => {
  const c = clock();
  const store = memoryStore();
  const g1 = createGate({ store, now: c.now, sleep: c.sleep, doFetch: async () => res(429) });
  await assert.rejects(g1.fetch('a'));
  const g2 = createGate({ store, now: c.now, sleep: c.sleep, doFetch: async () => assert.fail('must not call') });
  await assert.rejects(g2.fetch('b'), CsfloatPausedError);
});

test('resumeTimeFrom reads epoch and relative resets', () => {
  const h = (o) => new Headers(o);
  assert.equal(resumeTimeFrom(h({ 'x-ratelimit-reset': '1700000100' }), 0), 1_700_000_100_000);
  assert.equal(resumeTimeFrom(h({ 'x-ratelimit-reset': '45' }), 1000), 46_000);
  assert.equal(resumeTimeFrom(h({}), 0), null);
});
