// Snipes page — items to buy on one market and sell on another after fees,
// filtered for liquidity so hard-to-sell items stay hidden.
import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, RotateCcw, AlertTriangle, Lock, Sticker, SlidersHorizontal } from "lucide-react";
import { useSnipes } from "../hooks/useSnipes";
import {
  BUY_MARKETS, DEFAULT_SNIPE_FILTERS, SELL_MARKETS, SNIPE_MARKETS, migrateFilters, selectSnipes,
} from "../utils/snipes";
import { PlatformBadge } from "../components/PlatformBadge";
import { useItemImage } from "../utils/itemImages";
import { CURRENCIES } from "../hooks/useExchangeRate";

const STORAGE_KEY = "skinroi-snipes-filters";
// Snipes has its own currency (USD by default), separate from the site-wide
// display currency, because marketplace prices are compared in dollars.
const CURRENCY_KEY = "skinroi-snipes-currency";
const MARKET_LABELS = { csfloat: "CSFloat", dmarket: "DMarket", youpin: "YouPin", buff163: "Buff163" };

// The demo preview only has deals 15+ minutes old and no saved filters, so
// it starts from looser defaults to have something to show.
const DEMO_FILTERS = { ...DEFAULT_SNIPE_FILTERS, sellMarkets: SELL_MARKETS, minLiquidity: 30, maxAgeMin: 60 };

function loadFilters(demo) {
  if (demo) return DEMO_FILTERS;
  try {
    const saved = migrateFilters(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    return saved ? { ...DEFAULT_SNIPE_FILTERS, ...saved } : DEFAULT_SNIPE_FILTERS;
  } catch {
    return DEFAULT_SNIPE_FILTERS;
  }
}

function ago(ms, now) {
  if (!ms) return "—";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function SnipesPage({ theme, rates, demo = false, onLogin }) {
  const { deals, meta, error, loading, refresh } = useSnipes({ demo });
  const [filters, setFilters] = useState(() => loadFilters(demo));
  const [currency, setCurrency] = useState(() => {
    try { return localStorage.getItem(CURRENCY_KEY) || "USD"; } catch { return "USD"; }
  });
  const [now, setNow] = useState(Date.now());
  // Phones show the filters behind a toggle so the deals come first.
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (demo) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); } catch { /* ignore */ }
  }, [filters, demo]);

  useEffect(() => {
    try { localStorage.setItem(CURRENCY_KEY, currency); } catch { /* ignore */ }
  }, [currency]);

  // Re-render every 10s so "seen 2m ago" and age filters stay current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  // Until the rates have loaded, show dollars rather than a wrong conversion.
  const liveRate = currency === "USD" ? 1 : rates?.[currency];
  const rate = liveRate || 1;
  const symbol = liveRate ? CURRENCIES.find((c) => c.code === currency)?.symbol || currency : "$";
  const money = (usd) => `${symbol}${(usd * rate).toFixed(2)}`;

  const visible = useMemo(
    () => selectSnipes(deals, filters, { rate, now }),
    [deals, filters, rate, now],
  );

  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 px-4 md:px-6 py-4 overflow-y-auto md:overflow-hidden">
      <FilterPanel
        open={filtersOpen}
        theme={theme}
        filters={filters}
        set={set}
        symbol={symbol}
        onReset={() => setFilters(demo ? DEMO_FILTERS : DEFAULT_SNIPE_FILTERS)}
      />

      <div className={`md:flex-1 min-w-0 flex flex-col ${theme.panel} border ${theme.panelBorder} rounded-2xl md:overflow-hidden`}>
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 md:px-5 py-3 border-b ${theme.panelBorder}`}>
          <h2 className={`font-semibold ${theme.text}`}>Snipes</h2>
          <span className={`text-xs ${theme.subtext}`}>
            {visible.length} of {deals.length} shown
          </span>
          {demo ? (
            <span className="text-[11px] text-warn">Delayed 15+ min preview</span>
          ) : (
            <ScanStatus meta={meta} now={now} theme={theme} />
          )}
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={`md:hidden ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${theme.cardBorder} ${filtersOpen ? theme.text : theme.subtext}`}
          >
            <SlidersHorizontal size={13} /> Filters
          </button>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            title="Currency"
            aria-label="Currency"
            className={`md:ml-auto px-2 py-1 rounded-lg text-xs border ${theme.input} ${theme.text} focus:outline-none`}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
          <button
            onClick={refresh}
            title="Refresh"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {demo && (
          <div className={`px-4 md:px-5 py-2.5 text-xs border-b ${theme.panelBorder} flex flex-wrap items-center gap-x-3 gap-y-1.5 ${theme.textSecondary}`}>
            <span>
              These deals were found 15 minutes or more ago and are probably gone. Signed-in users see new ones within a minute, with buy links.
            </span>
            <button
              onClick={onLogin}
              className={`ml-auto shrink-0 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${theme.cardBorder} ${theme.text} hover:bg-white/5 active:scale-[0.97]`}
            >
              Sign in for real time
            </button>
          </div>
        )}

        {!demo && meta?.refProvider === "csgotrader" && (
          <div className="px-5 py-2 text-xs text-warn border-b border-white/5 flex items-center gap-2">
            <AlertTriangle size={13} />
            Using free Buff163 prices (no listing counts). Set STEAMDT_API_KEY for YouPin prices and listing counts.
          </div>
        )}

        <div className="md:flex-1 md:overflow-y-auto">
          {error && <p className="p-6 text-sm text-loss">{error}</p>}
          {!error && loading && <p className={`p-6 text-sm ${theme.subtext}`}>Scanning markets…</p>}
          {!error && !loading && visible.length === 0 && (
            <p className={`p-6 text-sm ${theme.subtext}`}>
              {demo
                ? "No delayed deals match these filters right now. Try a lower min ROI or liquidity."
                : "No deals match your filters right now. New listings are checked about every 45 seconds."}
            </p>
          )}
          {visible.map((d) => (
            <SnipeRow key={d.id} deal={d} theme={theme} money={money} now={now} onLogin={demo ? onLogin : null} />
          ))}
        </div>
      </div>
    </div>
  );
}

// CSFloat listings arrive from the browser extension; if none came in for
// this long, the extension is probably not running (Chrome closed, not paired).
const EXTENSION_STALE_MS = 10 * 60 * 1000;

function sourceText(name, s, now) {
  if (!s || (s.via === "extension" && now - s.lastRun > EXTENSION_STALE_MS)) {
    return name === "csfloat" ? "· waiting for the SkinROI extension (is Chrome open?)" : "· not checked yet";
  }
  if (s.ok) return `· ${s.count}`;
  if (s.pausedUntil && s.pausedUntil > now) {
    return `· rate limited, retrying in ${Math.ceil((s.pausedUntil - now) / 60000)}m`;
  }
  return `· failed: ${s.error}`;
}

function ScanStatus({ meta, now, theme }) {
  if (!meta) return null;
  const sources = meta.sources || {};
  return (
    <span className={`flex items-center gap-3 text-[11px] ${theme.subtext}`}>
      <span>Scanned {ago(meta.lastScan, now)}</span>
      {SNIPE_MARKETS.map((name) => {
        const s = sources[name];
        const bad = s && !s.ok;
        return (
          <span
            key={name}
            title={s?.ok ? `${s.count} listings checked ${ago(s.lastRun, now)}` : s?.error}
            className={`max-w-xs truncate ${bad ? "text-loss" : ""}`}
          >
            {MARKET_LABELS[name] || name} {sourceText(name, s, now)}
          </span>
        );
      })}
      {meta.refError && (
        <span className="text-loss">Reference prices · {meta.refError}</span>
      )}
    </span>
  );
}

// The listing's own image is missing on some CSFloat/DMarket rows, and some
// of the URLs they send don't load. Fall back to the items.json picture for
// the same name, then to an empty box.
function SnipeImage({ image, name }) {
  const fallback = useItemImage({ name });
  const [failed, setFailed] = useState([]);
  const src = [image, fallback].find((u) => u && !failed.includes(u));
  if (!src) return <div className="w-12 h-9 md:w-16 md:h-12 shrink-0" />;
  return (
    <img
      src={src}
      alt=""
      className="w-12 h-9 md:w-16 md:h-12 object-contain shrink-0"
      loading="lazy"
      onError={() => setFailed((f) => [...f, src])}
    />
  );
}

// onLogin is set in the demo: deals come without links, so the button asks
// the visitor to sign in instead.
function SnipeRow({ deal: d, theme, money, now, onLogin }) {
  const liq = d.liquidity;
  const liquidityText = liq.score != null ? `Liquidity ${liq.score}` : "Liquidity unknown";
  const liquidityDetail = [
    liq.bidCount != null && `${liq.bidCount} buy orders`,
    liq.bidAsk != null && `best buy order ${Math.round(liq.bidAsk * 100)}% of lowest ask`,
    liq.count != null && `${liq.count} listed`,
    liq.sales != null && `${liq.sales} CSFloat sales`,
    liq.steamVolume != null && `${liq.steamVolume} sold on Steam today`,
  ].filter(Boolean).join(" · ");

  return (
    <div className={`flex flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-2 px-4 md:px-5 py-3 border-b ${theme.panelBorder} ${theme.itemHoverBg || "hover:bg-white/5"}`}>
      <SnipeImage image={d.image} name={d.name} />

      <div className="flex-1 min-w-0 basis-[calc(100%-4rem)] md:basis-auto">
        <p className={`text-sm font-medium truncate ${theme.text}`} title={d.name}>
          {d.name}
          {d.phase && <span className={`ml-1.5 ${theme.accent}`}>{d.phase}</span>}
        </p>
        <div className={`flex items-center gap-2 text-[11px] ${theme.subtext}`}>
          {d.itemLevel && <span>Lowest listing</span>}
          {d.float != null && <span>Float {Number(d.float).toFixed(4)}</span>}
          {d.stickers?.length > 0 && (
            <span className="flex items-center gap-0.5" title={d.stickers.map((s) => s.name).join(", ")}>
              <Sticker size={11} /> {d.stickers.length}
              {d.stickerValueUsd > 0 && ` (${money(d.stickerValueUsd)})`}
            </span>
          )}
          {d.tradeLocked && (
            <span className="flex items-center gap-0.5 text-warn"><Lock size={11} /> Trade locked</span>
          )}
          <span>Seen {ago(d.seenAt, now)}</span>
        </div>
      </div>

      <div className="md:w-32 shrink-0 md:text-right">
        <PlatformBadge platform={d.market} size="xs" />
        <p className={`text-sm font-mono ${theme.text}`}>{money(d.priceUsd)}</p>
      </div>

      <div className="md:w-36 shrink-0 md:text-right">
        <PlatformBadge platform={d.refMarket} size="xs" />
        <p className={`text-sm font-mono ${theme.textSecondary}`}>{money(d.ref.priceUsd)}</p>
        <p className={`text-[11px] ${theme.subtext}`} title={liquidityDetail || undefined}>{liquidityText}</p>
      </div>

      <div className="ml-auto md:ml-0 md:w-28 shrink-0 text-right">
        <p className="text-sm font-mono font-semibold text-profit">+{money(d.profitUsd)}</p>
        <p className={`text-xs font-mono ${theme.subtext}`}>{(d.roi * 100).toFixed(1)}%</p>
      </div>

      {onLogin || !d.url ? (
        <button
          onClick={onLogin || undefined}
          disabled={!onLogin}
          title="Sign in with Steam to get buy links"
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${theme.cardBorder} ${theme.subtext} hover:bg-white/5 active:scale-[0.97] disabled:opacity-40`}
        >
          <Lock size={12} /> Buy
        </button>
      ) : (
        <a
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${theme.cardBorder} ${theme.text} hover:bg-white/5 active:scale-[0.97]`}
        >
          Buy <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

function FilterPanel({ open, theme, filters: f, set, symbol, onReset }) {
  const label = `text-xs font-medium ${theme.subtext}`;
  const input = `w-full px-2 py-1.5 rounded-lg text-sm border ${theme.input} ${theme.text} focus:outline-none`;

  const numberField = (key, text, suffix) => (
    <label className="block">
      <span className={label}>{text}</span>
      <div className="flex items-center gap-1.5 mt-1">
        <input
          type="number"
          value={f[key]}
          onChange={(e) => set(key)(e.target.value === "" ? "" : Number(e.target.value))}
          className={input}
        />
        {suffix && <span className={`text-xs ${theme.subtext}`}>{suffix}</span>}
      </div>
    </label>
  );

  const toggle = (key, text) => (
    <label className={`flex items-center gap-2 text-sm cursor-pointer ${theme.textSecondary}`}>
      <input type="checkbox" checked={!!f[key]} onChange={(e) => set(key)(e.target.checked)} />
      {text}
    </label>
  );

  const marketChecks = (key, markets) => (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {markets.map((m) => (
        <label key={m} className={`flex items-center gap-1.5 text-sm cursor-pointer ${theme.textSecondary}`}>
          <input
            type="checkbox"
            checked={f[key].includes(m)}
            onChange={() => set(key)(f[key].includes(m) ? f[key].filter((x) => x !== m) : [...f[key], m])}
          />
          {MARKET_LABELS[m]}
        </label>
      ))}
    </div>
  );

  return (
    <aside className={`${open ? '' : 'hidden'} md:block order-first w-full md:w-72 shrink-0 md:overflow-y-auto ${theme.panel} border ${theme.panelBorder} rounded-2xl p-4 space-y-4`}>
      <div className="flex items-center">
        <h3 className={`font-semibold ${theme.text}`}>Filters</h3>
        <button
          onClick={onReset}
          className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-white"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <input
        type="text"
        placeholder="Search, e.g. ak redline"
        value={f.search}
        onChange={(e) => set("search")(e.target.value)}
        className={input}
      />

      <div>
        <span className={label}>Buy on</span>
        {marketChecks("buyMarkets", BUY_MARKETS)}
      </div>

      <div>
        <span className={label}>Sell on</span>
        {marketChecks("sellMarkets", SELL_MARKETS)}
        <p className={`text-[11px] mt-1 ${theme.subtext}`}>Each deal uses the sell market that pays most after fees.</p>
      </div>

      <label className="block">
        <span className={label}>Sort by</span>
        <select value={f.sortBy} onChange={(e) => set("sortBy")(e.target.value)} className={`${input} mt-1`}>
          <option value="roi">Highest ROI</option>
          <option value="profit">Highest profit</option>
          <option value="newest">Newest</option>
          <option value="price">Lowest price</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        {numberField("minRoi", "Min ROI", "%")}
        {numberField("minProfit", "Min profit", symbol)}
        {numberField("minPrice", "Min price", symbol)}
        {numberField("maxPrice", "Max price", symbol)}
      </div>
      {numberField("buyFee", "Extra buy cost (deposit etc.)", "%")}

      <div className={`pt-3 border-t ${theme.panelBorder} space-y-3`}>
        <p className={label}>Liquidity</p>
        {numberField("minLiquidity", "Min liquidity score (0–100)")}
        {toggle("hideUnknownLiquidity", "Hide unknown liquidity")}
        {toggle("hideVolatile", "Hide volatile prices")}
        {f.hideVolatile && numberField("maxChange7d", "Max 7d change", "%")}
      </div>

      <div className={`pt-3 border-t ${theme.panelBorder} space-y-2`}>
        <p className={label}>Items</p>
        {toggle("hideStatTrak", "Hide StatTrak™")}
        {toggle("hideSouvenir", "Hide Souvenir")}
        {toggle("hideTradeLocked", "Hide trade locked")}
        {toggle("hideStickered", "Hide items with stickers")}
      </div>

      <div className={`pt-3 border-t ${theme.panelBorder} grid grid-cols-2 gap-2`}>
        {numberField("maxAgeMin", "Max age", "min")}
        {numberField("maxRefAgeMin", "Max ref age", "min")}
      </div>
    </aside>
  );
}
