// The worker's browser: a Playwright Chromium with its own saved profile
// (worker/.profile), so the CSFloat login and Cloudflare cookies from
// `npm run login` are reused.
//
// One csfloat.com tab stays open. Calls run *inside* that tab with the page's
// own fetch(), exactly like the extension (same cookies, same origin, one
// request per call). Navigating to search pages and reading their responses
// would also work, but every page view fires several CSFloat API calls of its
// own, which spends the same ~5-a-minute budget on things we don't need.

import { chromium } from 'playwright';
import { PAGE_RELOAD_MS, PROFILE_DIR, config } from './config.js';

export function launchOptions({ headless = config.headless } = {}) {
  return {
    headless,
    channel: config.browserChannel,
    executablePath: config.executablePath,
    viewport: { width: 1280, height: 860 },
    locale: 'en-US',
  };
}

export function createCsfloatPage({ gate, log = console.log }) {
  let context = null;
  let page = null;
  let loadedAt = 0;

  // Call before a round, outside the gate's queue (it takes a gate slot for
  // the page load itself, so it must not run inside another gated call).
  async function prepare() {
    if (!context) {
      context = await chromium.launchPersistentContext(PROFILE_DIR, launchOptions());
      context.on('close', () => { context = null; page = null; });
    }
    if (!page || page.isClosed()) {
      page = context.pages()[0] || (await context.newPage());
      loadedAt = 0;
    }
    const onCsfloat = page.url().startsWith(config.csfloatOrigin);
    if (!onCsfloat || Date.now() - loadedAt > PAGE_RELOAD_MS) {
      await gate.markCall();
      log(`opening ${config.csfloatOrigin}/`);
      await page.goto(`${config.csfloatOrigin}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      loadedAt = Date.now();
    }
    return page;
  }

  // fetch() run in the csfloat.com tab. Returns a real Response so the gate
  // and callers can treat it like the extension's fetch result.
  async function pageFetch(path) {
    const p = page;
    if (!p || p.isClosed() || !loadedAt) throw new Error('csfloat.com tab not ready');
    const url = path.startsWith('http') ? path : `${config.csfloatOrigin}${path}`;
    const r = await p.evaluate(async (u) => {
      const res = await fetch(u, { credentials: 'include', headers: { accept: 'application/json' } });
      const headers = {};
      for (const k of ['content-type', 'retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
        const v = res.headers.get(k);
        if (v != null) headers[k] = v;
      }
      return { status: res.status, headers, body: await res.text() };
    }, url);
    if (r.status === 403 && /text\/html/.test(r.headers['content-type'] || '')) {
      // Cloudflare challenge instead of JSON: reload next time, and tell the user.
      loadedAt = 0;
      log('CSFloat answered with a Cloudflare page. Try `npm run login`, or HEADLESS=false in .env.');
    }
    return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
  }

  return {
    prepare,
    pageFetch,
    async close() {
      const c = context;
      context = null;
      page = null;
      if (c) await c.close().catch(() => {});
    },
    isOpen: () => !!context,
  };
}
