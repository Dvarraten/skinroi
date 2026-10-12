// USD per CNY, cached per warm instance. Same source as the frontend's
// useExchangeRate hook so the numbers line up with the rest of the app.

import { fetchJson } from './normalize.js';

const TTL_MS = 60 * 60 * 1000;
const FALLBACK_CNY_PER_USD = 7.15;

let cache = { cnyPerUsd: null, at: 0 };

export async function getCnyPerUsd() {
  if (cache.cnyPerUsd && Date.now() - cache.at < TTL_MS) return cache.cnyPerUsd;
  try {
    const data = await fetchJson('https://api.exchangerate-api.com/v4/latest/USD');
    const rate = data?.rates?.CNY;
    if (rate > 0) {
      cache = { cnyPerUsd: rate, at: Date.now() };
      return rate;
    }
  } catch (e) {
    console.warn('[snipes] fx fetch failed:', e.message);
  }
  return cache.cnyPerUsd || FALLBACK_CNY_PER_USD;
}
