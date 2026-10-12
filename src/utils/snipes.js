// Snipes math + filtering. The server sends every listing it found under
// reference price; this decides which ones are actually worth buying after
// fees and whether they'll be easy to sell again.
import { getPlatformFee } from "./platformFees";

export const SNIPE_MARKETS = ["csfloat", "dmarket"];

export const DEFAULT_SNIPE_FILTERS = {
  reference: "auto",          // auto = YouPin, falling back to Buff163
  markets: SNIPE_MARKETS,
  minRoi: 5,                  // %
  minProfit: 1,               // display currency
  minPrice: "",               // display currency, "" = no limit
  maxPrice: "",
  buyFee: 0,                  // % added to the buy price (deposit fees etc.)
  minListings: 20,            // listings on the reference market
  minLiquidity: 0,            // CSPriceAPI liquidity score
  minBidAsk: 85,              // buy order as % of lowest ask (Buff fallback)
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

export function pickReference(deal, reference) {
  const { youpin, buff163 } = deal.refs || {};
  if (reference === "youpin") return youpin ? { market: "youpin", ref: youpin } : null;
  if (reference === "buff163") return buff163 ? { market: "buff163", ref: buff163 } : null;
  if (youpin) return { market: "youpin", ref: youpin };
  if (buff163) return { market: "buff163", ref: buff163 };
  return null;
}

// Adds ref, profit, roi and liquidity fields to a raw deal from /api/snipes.
export function evaluateDeal(deal, filters) {
  const picked = pickReference(deal, filters.reference);
  if (!picked) return { ...deal, ref: null };
  const { market: refMarket, ref } = picked;
  const cost = deal.priceUsd * (1 + (Number(filters.buyFee) || 0) / 100);
  const netSell = ref.priceUsd * (1 - getPlatformFee(refMarket));
  const profitUsd = netSell - cost;
  return {
    ...deal,
    ref,
    refMarket,
    netSellUsd: netSell,
    profitUsd,
    roi: cost > 0 ? profitUsd / cost : 0,
    liquidity: {
      count: ref.count ?? null,
      score: ref.liquidity ?? null,
      bidAsk: ref.bidUsd && ref.askUsd ? ref.bidUsd / ref.askUsd : null,
    },
  };
}

const num = (v) => (v === "" || v == null ? null : Number(v));

// rate converts USD to the display currency used by the price filters.
export function passesFilters(d, f, { rate = 1, now = Date.now() } = {}) {
  if (!d.ref) return false;
  if (!f.markets.includes(d.market)) return false;
  if (d.roi * 100 < f.minRoi) return false;
  if (d.profitUsd * rate < (num(f.minProfit) ?? -Infinity)) return false;

  const price = d.priceUsd * rate;
  if (num(f.minPrice) != null && price < num(f.minPrice)) return false;
  if (num(f.maxPrice) != null && price > num(f.maxPrice)) return false;

  const { count, score, bidAsk } = d.liquidity;
  if (count != null && count < f.minListings) return false;
  if (score != null && score < f.minLiquidity) return false;
  if (bidAsk != null && bidAsk * 100 < f.minBidAsk) return false;
  if (f.hideUnknownLiquidity && count == null && score == null && bidAsk == null) return false;

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
