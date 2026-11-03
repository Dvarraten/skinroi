// Snipes page — listings on CSFloat / DMarket priced below YouPin (or Buff163)
// after fees, filtered for liquidity so hard-to-sell items stay hidden.
import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, RotateCcw, AlertTriangle, Lock, Sticker } from "lucide-react";
import { useSnipes } from "../hooks/useSnipes";
import { DEFAULT_SNIPE_FILTERS, SNIPE_MARKETS, selectSnipes } from "../utils/snipes";
import { PlatformBadge } from "../components/PlatformBadge";

const STORAGE_KEY = "skinroi-snipes-filters";
const MARKET_LABELS = { csfloat: "CSFloat", dmarket: "DMarket" };

function loadFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
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

export default function SnipesPage({ theme, exchangeRate, currencySymbol = "$" }) {
  const { deals, meta, error, loading, refresh } = useSnipes();
  const [filters, setFilters] = useState(loadFilters);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); } catch { /* ignore */ }
  }, [filters]);

  // Re-render every 10s so "seen 2m ago" and age filters stay current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const rate = exchangeRate || 1;
  const symbol = exchangeRate ? currencySymbol : "$";
  const money = (usd) => `${symbol}${(usd * rate).toFixed(2)}`;

  const visible = useMemo(
    () => selectSnipes(deals, filters, { rate, now }),
    [deals, filters, rate, now],
  );

  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex-1 min-h-0 flex gap-4 px-6 py-4 overflow-hidden">
      <FilterPanel
        theme={theme}
        filters={filters}
        set={set}
        symbol={symbol}
        onReset={() => setFilters(DEFAULT_SNIPE_FILTERS)}
      />

      <div className={`flex-1 min-w-0 flex flex-col ${theme.panel} border ${theme.panelBorder} rounded-2xl shadow-lg overflow-hidden`}>
        <div className={`flex items-center gap-3 px-5 py-3 border-b ${theme.panelBorder}`}>
          <h2 className={`font-semibold ${theme.text}`}>Snipes</h2>
          <span className={`text-xs ${theme.subtext}`}>
            {visible.length} of {deals.length} shown
          </span>
          <ScanStatus meta={meta} now={now} theme={theme} />
          <button
            onClick={refresh}
            title="Refresh"
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {meta?.refProvider === "csgotrader" && (
          <div className="px-5 py-2 text-xs text-warn border-b border-white/5 flex items-center gap-2">
            <AlertTriangle size={13} />
            Using free Buff163 prices (no listing counts). Set CSPRICEAPI_KEY for YouPin prices and liquidity data.
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {error && <p className="p-6 text-sm text-loss">{error}</p>}
          {!error && loading && <p className={`p-6 text-sm ${theme.subtext}`}>Scanning markets…</p>}
          {!error && !loading && visible.length === 0 && (
            <p className={`p-6 text-sm ${theme.subtext}`}>
              No deals match your filters right now. New listings are checked about every 45 seconds.
            </p>
          )}
          {visible.map((d) => (
            <SnipeRow key={d.id} deal={d} theme={theme} money={money} now={now} />
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
        <span className="text-loss" title={meta.refError}>Reference prices failed</span>
      )}
    </span>
  );
}

function SnipeRow({ deal: d, theme, money, now }) {
  const liq = d.liquidity;
  const liquidityText = [
    liq.count != null && `${liq.count} listed`,
    liq.score != null && `liq ${liq.score}`,
    liq.bidAsk != null && `bid ${Math.round(liq.bidAsk * 100)}%`,
  ].filter(Boolean).join(" · ") || "liquidity unknown";

  return (
    <div className={`flex items-center gap-4 px-5 py-3 border-b ${theme.panelBorder} ${theme.itemHoverBg || "hover:bg-white/5"}`}>
      {d.image ? (
        <img src={d.image} alt="" className="w-16 h-12 object-contain shrink-0" loading="lazy" />
      ) : (
        <div className="w-16 h-12 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${theme.text}`} title={d.name}>
          {d.name}
          {d.phase && <span className={`ml-1.5 ${theme.accent}`}>{d.phase}</span>}
        </p>
        <div className={`flex items-center gap-2 text-[11px] ${theme.subtext}`}>
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

      <div className="w-32 shrink-0 text-right">
        <PlatformBadge platform={d.market} size="xs" />
        <p className={`text-sm font-mono ${theme.text}`}>{money(d.priceUsd)}</p>
      </div>

      <div className="w-36 shrink-0 text-right">
        <PlatformBadge platform={d.refMarket} size="xs" />
        <p className={`text-sm font-mono ${theme.textSecondary}`}>{money(d.ref.priceUsd)}</p>
        <p className={`text-[10px] ${theme.subtext}`}>{liquidityText}</p>
      </div>

      <div className="w-28 shrink-0 text-right">
        <p className="text-sm font-mono font-semibold text-profit">+{money(d.profitUsd)}</p>
        <p className="text-xs font-mono text-profit">{(d.roi * 100).toFixed(1)}%</p>
      </div>

      <a
        href={d.url}
        target="_blank"
        rel="noreferrer"
        className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${theme.accentBg}`}
      >
        Buy <ExternalLink size={12} />
      </a>
    </div>
  );
}

function FilterPanel({ theme, filters: f, set, symbol, onReset }) {
  const label = `text-[10px] font-semibold uppercase tracking-wide ${theme.subtext}`;
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

  const toggleMarket = (m) =>
    set("markets")(f.markets.includes(m) ? f.markets.filter((x) => x !== m) : [...f.markets, m]);

  return (
    <aside className={`w-72 shrink-0 overflow-y-auto ${theme.panel} border ${theme.panelBorder} rounded-2xl shadow-lg p-4 space-y-4`}>
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
        <div className="flex gap-3 mt-1">
          {SNIPE_MARKETS.map((m) => (
            <label key={m} className={`flex items-center gap-1.5 text-sm cursor-pointer ${theme.textSecondary}`}>
              <input type="checkbox" checked={f.markets.includes(m)} onChange={() => toggleMarket(m)} />
              {MARKET_LABELS[m]}
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className={label}>Reference price</span>
        <select value={f.reference} onChange={(e) => set("reference")(e.target.value)} className={`${input} mt-1`}>
          <option value="auto">YouPin, else Buff163</option>
          <option value="youpin">YouPin only</option>
          <option value="buff163">Buff163 only</option>
        </select>
      </label>

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
        <div className="grid grid-cols-2 gap-2">
          {numberField("minListings", "Min listings")}
          {numberField("minLiquidity", "Min score")}
        </div>
        {numberField("minBidAsk", "Min buy order / ask", "%")}
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
