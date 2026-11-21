// How easily an item sells on a market, 0–100. Shared by the Snipes page
// (src/utils/snipes.js, the "Min liquidity" filter and the score shown) and
// the server prefilter (api/_lib/snipes/liquidity.js, which drops items
// under 75 before storing them), so both always agree.
// Plain JS with no imports: it runs both in the CRA bundle and in Node.

// 0..1 helpers: log scale reaches 1 at `full`, linear maps lo..hi to 0..1.
const logScale = (v, full) => (v == null ? null : Math.min(1, Math.log10(1 + Math.max(0, v)) / Math.log10(1 + full)));
const linear = (v, lo, hi) => (v == null ? null : Math.max(0, Math.min(1, (v - lo) / (hi - lo))));

// YouPin / Buff163: buy orders waiting 40 % (demand), best buy order / lowest
// ask 40 % (a tight spread sells fast), listings 20 %. CSFloat: the sales
// CSFloat recorded 60 %, Steam's daily volume 40 %. Missing parts are left
// out and the rest re-weighted; null if none known.
export function liquidityScore(market, ref) {
  if (!ref) return null;
  const bidAsk = ref.bidUsd && ref.askUsd ? ref.bidUsd / ref.askUsd : null;
  const parts = market === 'csfloat'
    ? [[logScale(ref.sales, 50), 0.6], [logScale(ref.steamVolume, 50), 0.4]]
    : [[logScale(ref.bidCount, 100), 0.4], [linear(bidAsk, 0.75, 0.97), 0.4], [logScale(ref.count, 200), 0.2]];
  const known = parts.filter(([v]) => v != null);
  if (!known.length) return null;
  const weight = known.reduce((sum, [, w]) => sum + w, 0);
  return Math.round((100 * known.reduce((sum, [v, w]) => sum + v * w, 0)) / weight);
}
