// Snipes page — items to buy on one market and sell on another after fees,
// filtered for liquidity so hard-to-sell items stay hidden.
import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, RotateCcw, AlertTriangle, Lock, Sticker, SlidersHorizontal, Search, ChevronDown } from "lucide-react";
import { useSnipes } from "../hooks/useSnipes";
import {
  BUY_MARKETS, DEFAULT_SNIPE_FILTERS, SELL_MARKETS, SNIPE_MARKETS, migrateFilters, selectSnipes,
} from "../utils/snipes";
import { PlatformBadge, PLATFORM_CONFIG } from "../components/PlatformBadge";
import { Chip, Field, Input, SectionTitle, Select, Switch } from "../components/ui";
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

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: c.code }));

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
    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
      <FilterPanel
        open={filtersOpen}
        theme={theme}
        filters={filters}
        set={set}
        symbol={symbol}
        defaults={demo ? DEMO_FILTERS : DEFAULT_SNIPE_FILTERS}
        onClose={() => setFiltersOpen(false)}
        count={visible.length}
        onReset={() => setFilters(demo ? DEMO_FILTERS : DEFAULT_SNIPE_FILTERS)}
      />

      <div className="md:flex-1 min-w-0 flex flex-col md:overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 md:px-8 pt-6 md:pt-8 pb-4">
          <h1 className={`text-xl font-semibold tracking-tight ${theme.text}`}>Snipes</h1>
          <span className={`text-xs font-mono ${theme.subtext}`}>
            {visible.length} of {deals.length}
          </span>
          {demo ? (
            <span className="text-[11px] text-warn">Delayed 15+ min preview</span>
          ) : (
            <ScanStatus meta={meta} now={now} theme={theme} />
          )}
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={`md:hidden ml-auto flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium ${filtersOpen ? `${theme.navActive} border-transparent` : `${theme.cardBorder} ${theme.subtext}`}`}
          >
            <SlidersHorizontal size={13} /> Filters
          </button>
          <Select
            theme={theme}
            compact
            align="right"
            ariaLabel="Currency"
            className="md:ml-auto w-[76px]"
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_OPTIONS}
          />
          <button
            onClick={refresh}
            title="Refresh"
            aria-label="Refresh"
            className={`h-8 w-8 flex items-center justify-center rounded-lg ${theme.subtext} ${theme.textHover} ${theme.itemHoverBg}`}
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {demo && (
          <div className={`px-4 md:px-8 py-2.5 text-xs border-y ${theme.panelBorder} flex flex-wrap items-center gap-x-3 gap-y-1.5 ${theme.textSecondary}`}>
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
          <div className={`px-4 md:px-8 py-2 text-xs text-warn border-y ${theme.panelBorder} flex items-center gap-2`}>
            <AlertTriangle size={13} />
            Using free Buff163 prices (no listing counts). Set STEAMDT_API_KEY for YouPin prices and listing counts.
          </div>
        )}

        {/* Column labels, lined up with the rows below */}
        {visible.length > 0 && (
          <div className={`hidden md:flex items-center gap-x-4 px-8 pb-2 text-xs border-b [scrollbar-gutter:stable] overflow-y-hidden ${theme.panelBorder} ${theme.subtext}`}>
            <span className="w-16 shrink-0" />
            <span className="flex-1">Listing</span>
            <span className="w-32 shrink-0 text-right">Buy at</span>
            <span className="w-36 shrink-0 text-right">Sell at</span>
            <span className="w-28 shrink-0 text-right">Profit after fees</span>
            <span className="w-[68px] shrink-0" />
          </div>
        )}

        <div className="md:flex-1 md:overflow-y-auto [scrollbar-gutter:stable]">
          {error && <p className="px-4 md:px-8 py-6 text-sm text-loss">{error}</p>}
          {!error && loading && <p className={`px-4 md:px-8 py-6 text-sm ${theme.subtext}`}>Scanning markets…</p>}
          {!error && !loading && visible.length === 0 && (
            <p className={`px-4 md:px-8 py-6 text-sm ${theme.subtext}`}>
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
    <span className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0 text-[11px] ${theme.subtext}`}>
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
    <div className={`flex flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-2 px-4 md:px-8 py-3 border-b ${theme.panelBorder} ${theme.itemHoverBg}`}>
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
          className={`shrink-0 w-[68px] flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${theme.cardBorder} ${theme.subtext} ${theme.itemHoverBg} disabled:opacity-40`}
        >
          <Lock size={12} /> Buy
        </button>
      ) : (
        <a
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className={`shrink-0 w-[68px] flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme.primary}`}
        >
          Buy <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "roi", label: "Highest ROI" },
  { value: "profit", label: "Highest profit" },
  { value: "newest", label: "Newest" },
  { value: "price", label: "Lowest price" },
];

// Keys the "More" section holds, so it opens by itself when one is changed.
const MORE_KEYS = ["buyFee", "maxAgeMin", "maxRefAgeMin"];

function FilterPanel({ open, theme, filters: f, set, symbol, defaults, onReset, onClose, count }) {
  const changed = (keys) => keys.some((k) => JSON.stringify(f[k]) !== JSON.stringify(defaults[k]));
  const dirty = changed(Object.keys(defaults).filter((k) => k !== "version"));
  const [moreOpen, setMoreOpen] = useState(() => changed(MORE_KEYS));

  const number = (key, props = {}) => (
    <Input
      theme={theme}
      type="number"
      value={f[key]}
      onChange={(e) => set(key)(e.target.value === "" ? "" : Number(e.target.value))}
      {...props}
    />
  );

  const markets = (key, list) => (
    <div className="flex flex-wrap gap-1.5">
      {list.map((m) => (
        <Chip
          key={m}
          theme={theme}
          icon={PLATFORM_CONFIG[m]?.icon}
          selected={f[key].includes(m)}
          onClick={() => set(key)(f[key].includes(m) ? f[key].filter((x) => x !== m) : [...f[key], m])}
        >
          {MARKET_LABELS[m]}
        </Chip>
      ))}
    </div>
  );

  const section = `pt-5 border-t ${theme.panelBorder} space-y-3`;
  const liquidity = Number(f.minLiquidity) || 0;

  return (
    <aside className={`${open ? '' : 'hidden'} md:block order-first md:order-last w-full md:w-[288px] shrink-0 md:overflow-y-auto [scrollbar-gutter:stable] border-b md:border-b-0 md:border-l ${theme.panelBorder} px-4 py-4 md:px-5 md:py-8 space-y-5`}>
      <div className="flex items-center md:h-7">
        <h2 className={`text-sm font-semibold ${theme.text}`}>Filters</h2>
        <button
          onClick={onReset}
          disabled={!dirty}
          className={`ml-auto flex items-center gap-1 h-7 px-2 -mr-2 rounded-md text-xs ${theme.subtext} ${theme.textHover} ${theme.itemHoverBg} disabled:opacity-0 disabled:pointer-events-none`}
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <div className="space-y-3">
        <Input
          theme={theme}
          prefix={<Search size={13} className="translate-y-px" />}
          placeholder="Search, e.g. ak redline"
          aria-label="Search deals"
          value={f.search}
          onChange={(e) => set("search")(e.target.value)}
        />
        <Field theme={theme} label="Sort by">
          <Select theme={theme} value={f.sortBy} onChange={set("sortBy")} options={SORT_OPTIONS} ariaLabel="Sort by" />
        </Field>
      </div>

      <div className={section}>
        <SectionTitle theme={theme}>Markets</SectionTitle>
        <Field theme={theme} label="Buy on">{markets("buyMarkets", BUY_MARKETS)}</Field>
        <Field theme={theme} label="Sell on" hint="Each deal uses the sell market that pays most after fees.">
          {markets("sellMarkets", SELL_MARKETS)}
        </Field>
      </div>

      <div className={section}>
        <SectionTitle theme={theme}>Profit and price</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Field theme={theme} label="Min ROI">{number("minRoi", { suffix: "%" })}</Field>
          <Field theme={theme} label="Min profit">{number("minProfit", { prefix: symbol })}</Field>
        </div>
        <Field theme={theme} label="Buy price">
          <div className="flex items-center gap-2">
            {number("minPrice", { prefix: symbol, placeholder: "Min", "aria-label": "Min buy price" })}
            <span className={`text-xs ${theme.subtext}`}>to</span>
            {number("maxPrice", { prefix: symbol, placeholder: "Max", "aria-label": "Max buy price" })}
          </div>
        </Field>
      </div>

      <div className={section}>
        <SectionTitle theme={theme}>Liquidity</SectionTitle>
        <Field
          theme={theme}
          label="Min liquidity score"
          aside={<span className={`text-xs font-mono ${theme.text}`}>{liquidity}</span>}
          hint="0 to 100 on the sell market. Higher sells faster."
        >
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={liquidity}
            onChange={(e) => set("minLiquidity")(Number(e.target.value))}
            aria-label="Min liquidity score"
            className="slider"
            style={{ "--fill": `${liquidity}%` }}
          />
        </Field>
        <div>
          <Switch theme={theme} label="Hide unknown liquidity" checked={f.hideUnknownLiquidity} onChange={set("hideUnknownLiquidity")} />
          <Switch theme={theme} label="Hide volatile prices" checked={f.hideVolatile} onChange={set("hideVolatile")} />
        </div>
        {f.hideVolatile && (
          <Field theme={theme} label="Volatile means a 7-day change over">{number("maxChange7d", { suffix: "%" })}</Field>
        )}
      </div>

      <div className={`pt-5 border-t ${theme.panelBorder} space-y-2`}>
        <SectionTitle theme={theme}>Hide</SectionTitle>
        <div>
          <Switch theme={theme} label="StatTrak™" checked={f.hideStatTrak} onChange={set("hideStatTrak")} />
          <Switch theme={theme} label="Souvenir" checked={f.hideSouvenir} onChange={set("hideSouvenir")} />
          <Switch theme={theme} label="Trade locked" checked={f.hideTradeLocked} onChange={set("hideTradeLocked")} />
          <Switch theme={theme} label="Items with stickers" checked={f.hideStickered} onChange={set("hideStickered")} />
        </div>
      </div>

      <div className={`pt-3 border-t ${theme.panelBorder}`}>
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
          className={`w-full flex items-center justify-between h-8 text-[13px] font-medium ${theme.subtext} ${theme.textHover}`}
        >
          More
          <ChevronDown size={14} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
        </button>
        {moreOpen && (
          <div className="pt-2 space-y-3">
            <Field theme={theme} label="Extra buy cost" hint="Added to every buy price, for deposit fees and the like.">
              {number("buyFee", { suffix: "%" })}
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field theme={theme} label="Listing seen within">{number("maxAgeMin", { suffix: "min" })}</Field>
              <Field theme={theme} label="Sell price within">{number("maxRefAgeMin", { suffix: "min" })}</Field>
            </div>
          </div>
        )}
      </div>

      {/* Phones: the panel covers the list, so say how to get back to it. */}
      <button
        type="button"
        onClick={onClose}
        className={`md:hidden w-full h-9 rounded-lg text-sm font-medium ${theme.primary}`}
      >
        Show {count} {count === 1 ? "deal" : "deals"}
      </button>
    </aside>
  );
}
