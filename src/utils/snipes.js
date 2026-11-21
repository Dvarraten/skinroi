// Snipes math + filtering. The server sends every listing (and every YouPin /
// Buff163 lowest ask) it found under what some other market pays; this picks
// the best market to sell on after fees and checks the item will sell again.
import { getPlatformFee } from "./platformFees";
import { liquidityScore } from "../shared/liquidity.js";

// Sources the scanner reads listings from (shown in the scan status).
export const SNIPE_MARKETS = ["csfloat", "dmarket"];
// Where a deal can be bought / sold. YouPin and Buff163 buys are the item's
// lowest ask there, not a specific listing.
export const BUY_MARKETS = ["csfloat", "dmarket", "youpin", "buff163"];
export const SELL_MARKETS = ["youpin", "buff163", "csfloat"];

export const DEFAULT_SNIPE_FILTERS = {
  version: 3,
  buyMarkets: ["csfloat", "dmarket"],
  sellMarkets: ["youpin", "buff163"],
  minRoi: 5,                  // %
  minProfit: 1,               // display currency
  minPrice: "",               // display currency, "" = no limit
  maxPrice: "",
  buyFee: 0,                  // % added to the buy price (deposit fees etc.)
  minLiquidity: 75,           // 0–100 score on the market we'd sell on
  hideUnknownLiquidity: true,
  hideVolatile: true,
  maxChange7d: 15,            // % price move over 7 days counted as volatile
  hideStatTrak: false,
  hideSouvenir: true,
  hideTradeLocked: false,
  hideStickered: false,
  maxAgeMin: 30,
  maxRefAgeMin: 60,
  search: "",
  sortBy: "roi",
};

// Older saved filters. Version 1 (before buy/sell markets): keep what still
// means the same, map the old "markets" to buy markets, drop the old
// liquidity fields. Version 2: the server now only keeps items scoring 75+,
// so a lower saved minimum is raised to the new default.
export function migrateFilters(saved) {
  if (!saved || saved.version === DEFAULT_SNIPE_FILTERS.version) return saved;
  if (saved.version === 2) {
    return {
      ...saved,
      minLiquidity: Math.max(Number(saved.minLiquidity) || 0, DEFAULT_SNIPE_FILTERS.minLiquidity),
      version: DEFAULT_SNIPE_FILTERS.version,
    };
  }
  const { markets, reference, minListings, minBidAsk, minLiquidity, ...rest } = saved;
  return {
    ...rest,
    ...(Array.isArray(markets) && markets.length ? { buyMarkets: markets } : {}),
    version: DEFAULT_SNIPE_FILTERS.version,
  };
}

// The 0–100 liquidity score is shared with the server prefilter.
export { liquidityScore };

function sellOption(market, ref, cost) {
  const netSell = ref.priceUsd * (1 - getPlatformFee(market));
  const bidAsk = ref.bidUsd && ref.askUsd ? ref.bidUsd / ref.askUsd : null;
  return {
    refMarket: market,
    ref,
    netSellUsd: netSell,
    profitUsd: netSell - cost,
    liquidity: {
      score: liquidityScore(market, ref),
      count: ref.count ?? null,
      bidCount: ref.bidCount ?? null,
      bidAsk,
      sales: ref.sales ?? null,
      steamVolume: ref.steamVolume ?? null,
    },
  };
}

const liquidEnough = (o, f) =>
  o.liquidity.score == null ? !f.hideUnknownLiquidity : o.liquidity.score >= f.minLiquidity;

// Adds ref, profit, roi and liquidity for the best market to sell on: the
// highest net price among the chosen sell markets that are liquid enough
// (or the highest overall, which the liquidity filter then hides).
export function evaluateDeal(deal, filters) {
  const cost = deal.priceUsd * (1 + (Number(filters.buyFee) || 0) / 100);
  const options = (filters.sellMarkets || [])
    // Buying an item's lowest ask and selling it on the same market is no deal.
    .filter((m) => deal.refs?.[m]?.priceUsd && !(deal.itemLevel && m === deal.market))
    .map((m) => sellOption(m, deal.refs[m], cost));
  if (!options.length) return { ...deal, ref: null };
  const byNet = (a, b) => b.netSellUsd - a.netSellUsd;
  const best = options.filter((o) => liquidEnough(o, filters)).sort(byNet)[0] || options.sort(byNet)[0];
  return { ...deal, ...best, roi: cost > 0 ? best.profitUsd / cost : 0 };
}

const num = (v) => (v === "" || v == null ? null : Number(v));

// rate converts USD to the display currency used by the price filters.
export function passesFilters(d, f, { rate = 1, now = Date.now() } = {}) {
  if (!d.ref) return false;
  if (!f.buyMarkets.includes(d.market)) return false;
  if (d.roi * 100 < f.minRoi) return false;
  if (d.profitUsd * rate < (num(f.minProfit) ?? -Infinity)) return false;

  const price = d.priceUsd * rate;
  if (num(f.minPrice) != null && price < num(f.minPrice)) return false;
  if (num(f.maxPrice) != null && price > num(f.maxPrice)) return false;

  if (!liquidEnough(d, f)) return false;

  if (f.hideVolatile && d.ref.change7d != null && Math.abs(d.ref.change7d) > f.maxChange7d) return false;
  if (d.ref.updatedAt && now - d.ref.updatedAt > f.maxRefAgeMin * 60000) return false;

  if (f.hideStatTrak && /StatTrak™/.test(d.name)) return false;
  if (f.hideSouvenir && /^Souvenir /.test(d.name)) return false;
  if (f.hideTradeLocked && d.tradeLocked) return false;
  if (f.hideStickered && d.stickers?.length) return false;
  if (now - d.seenAt > f.maxAgeMin * 60000) return false;

  if (f.search) {
    const terms = f.search.toLowerCase().split(/\s+/).filter(Boolean);
    const name = `${d.name} ${d.phase || ""}`.toLowerCase();
    if (!terms.every((t) => name.includes(t))) return false;
  }
  return true;
}

const SORTERS = {
  roi: (a, b) => b.roi - a.roi,
  profit: (a, b) => b.profitUsd - a.profitUsd,
  newest: (a, b) => (b.listedAt || b.seenAt) - (a.listedAt || a.seenAt),
  price: (a, b) => a.priceUsd - b.priceUsd,
};

export function selectSnipes(deals, filters, opts) {
  return deals
    .map((d) => evaluateDeal(d, filters))
    .filter((d) => passesFilters(d, filters, opts))
    .sort(SORTERS[filters.sortBy] || SORTERS.roi);
}
