import React, { useEffect, useMemo, useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle, Search, LayoutGrid, List } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip, CartesianGrid } from 'recharts';
import PlatformPicker from '../components/PlatformPicker';
import { TabButton } from '../components/TabsAndSearchbar';
import RecentSales from '../components/RecentSales';
import { PLATFORMS } from '../utils/platforms';
import { PROFIT_COLOR, LOSS_COLOR } from '../themes/themes';
import { getPlatformFee } from '../utils/platformFees';

const SORTS = [
  { label: 'Date', desc: 'date-new', asc: 'date-old' },
  { label: 'Name', desc: 'name-za',  asc: 'name-az'  },
];

const STEAM_IMG_BASE = 'https://community.akamai.steamstatic.com/economy/image/';

// ─── Name matching utilities ────────────────────────────────────────────────
const NAME_STOPWORDS = new Set([
  'stattrak', 'souvenir', 'the',
  'factory', 'new', 'minimal', 'wear', 'field', 'tested', 'well', 'worn',
  'battle', 'scarred',
]);

function tokenizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/★/g, ' ')
    .replace(/™/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[|/\-.,:'"]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !NAME_STOPWORDS.has(t));
}

function getSkinPart(name) {
  if (!name) return null;
  const stripped = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const pipeIdx = stripped.indexOf('|');
  if (pipeIdx === -1) return null;
  return stripped.slice(pipeIdx + 1).trim();
}

const WEAR_LEVELS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];
function getWearLevel(name) {
  return WEAR_LEVELS.find(w => (name || '').includes(w)) ?? null;
}

function nameMatchScore(steamName, trackerName) {
  const sw = getWearLevel(steamName);
  const tw = getWearLevel(trackerName);
  if (sw && tw && sw !== tw) return 0;
  const steamSkin = getSkinPart(steamName);
  if (steamSkin) {
    const steamSkinTokens = tokenizeName(steamSkin);
    if (steamSkinTokens.length === 0) return 0;
    const trackerCmp = getSkinPart(trackerName) ?? trackerName;
    const trackerTokens = new Set(tokenizeName(trackerCmp));
    if (trackerTokens.size === 0) return 0;
    const matched = steamSkinTokens.filter((t) => trackerTokens.has(t)).length;
    return matched / steamSkinTokens.length;
  }
  const steamTokens = new Set(tokenizeName(steamName));
  const trackerTokens = tokenizeName(trackerName);
  if (trackerTokens.length === 0 || steamTokens.size === 0) return 0;
  const matched = trackerTokens.filter((t) => steamTokens.has(t)).length;
  return matched / trackerTokens.length;
}

function formatCandidateLabel(c) {
  const base = `${c.itemName} · $${c.purchasePrice.toFixed(2)}`;
  if (c.matchType === 'fuzzy' && typeof c.matchScore === 'number') {
    const pct = Math.round(c.matchScore * 100);
    return `${base} (${pct}% match)`;
  }
  return base;
}

function InspectBadges({ entry, theme }) {
  const hasFloat = typeof entry.floatValue === 'number';
  const stickers = Array.isArray(entry.stickers) ? entry.stickers : [];
  const keychains = Array.isArray(entry.keychains) ? entry.keychains : [];
  if (!hasFloat && stickers.length === 0 && keychains.length === 0) return null;
  const stickerTip = stickers
    .map((s) => s.name || `#${s.stickerId}`)
    .concat(keychains.map((k) => `charm #${k.stickerId}`))
    .join(', ');
  return (
    <div className="flex items-center gap-1.5 mt-0.5 leading-tight">
      {hasFloat && (
        <span className={`text-[10px] font-mono ${theme.subtext}`}>
          fv {entry.floatValue.toFixed(4)}
        </span>
      )}
      {typeof entry.paintSeed === 'number' && (
        <span className={`text-[10px] font-mono ${theme.subtext}`}>
          seed {entry.paintSeed}
        </span>
      )}
      {(stickers.length > 0 || keychains.length > 0) && (
        <span
          className="text-[10px] font-mono text-warn"
          title={stickerTip}
        >
          {stickers.length > 0 ? `${stickers.length}×✱` : ''}
          {keychains.length > 0 ? ` ${keychains.length}×🔑` : ''}
        </span>
      )}
    </div>
  );
}

function ItemImage({ iconUrl, alt, size = 36 }) {
  const px = `${size}px`;
  if (!iconUrl) {
    return (
      <div style={{ width: px, height: px }} className="rounded bg-white/5 flex items-center justify-center text-[10px] text-slate-500 flex-shrink-0">
        ?
      </div>
    );
  }
  return (
    <img
      src={`${STEAM_IMG_BASE}${iconUrl}/96fx96f`}
      alt={alt || ''}
      style={{ width: px, height: px }}
      className="rounded bg-white/5 object-contain flex-shrink-0"
      loading="lazy"
    />
  );
}

// ─── Inline compact USD + local currency pair ──────────────────────────────
function PricePairCompact({ usdValue, localValue, onUsdChange, onLocalChange, theme, exchangeRate, currencySymbol, placeholderUsd = 'USD', placeholderLocal }) {
  const inputCls = `h-7 ${theme.input} rounded-lg pr-2 text-xs font-mono ${theme.text} focus:outline-none border w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
  return (
    <div className="flex items-center gap-1">
      <div className="relative w-[88px]">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-mono pointer-events-none">$</span>
        <input
          type="number" step="0.01" min="0"
          value={usdValue}
          onChange={(e) => onUsdChange(e.target.value)}
          placeholder={placeholderUsd}
          className={`${inputCls} pl-5`}
        />
      </div>
      <div className="relative w-[88px]">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-mono pointer-events-none">{currencySymbol}</span>
        <input
          type="number" step="0.01" min="0"
          value={localValue}
          onChange={(e) => onLocalChange(e.target.value)}
          disabled={!exchangeRate}
          placeholder={placeholderLocal || currencySymbol}
          className={`${inputCls} ${currencySymbol.length > 1 ? 'pl-8' : 'pl-5'} ${!exchangeRate ? 'opacity-50' : ''}`}
        />
      </div>
    </div>
  );
}

// ─── List/card shells ───────────────────────────────────────────────────────
// Incoming and outgoing entries render as table rows in list view and as cards
// in grid view. RowShell is the <tr> or the card; Cell is a <td> or a labelled
// block inside the card (`inline` puts the label and content on one line).
function RowShell({ grid, theme, children }) {
  if (!grid) {
    return <tr className={`border-b ${theme.cardBorder} hover:bg-white/[0.02] transition-colors`}>{children}</tr>;
  }
  return (
    <div className={`relative flex flex-col gap-2.5 p-3 rounded-xl border ${theme.panel} ${theme.cardBorder} ${theme.cardHover} transition-colors`}>
      {children}
    </div>
  );
}

function Cell({ grid, className = '', gridClassName = '', label, inline, theme, children, ...rest }) {
  if (!grid) return <td className={className} {...rest}>{children}</td>;
  const labelEl = label && (
    <p className={`text-[9px] font-semibold uppercase tracking-wider ${theme.subtext} ${inline ? '' : 'mb-1'}`}>{label}</p>
  );
  return (
    <div className={`${inline ? 'flex items-center justify-between gap-2' : ''} ${gridClassName}`}>
      {labelEl}
      {children}
    </div>
  );
}

// Table with a header row in list view, a responsive card grid in grid view.
function EntryList({ grid, head, children }) {
  if (grid) {
    return (
      <div className="grid gap-3 p-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
        {children}
      </div>
    );
  }
  return (
    <table className="w-full">
      <thead>{head}</thead>
      <tbody>{children}</tbody>
    </table>
  );
}

// ─── Compact incoming row (returns <tr>, or a card in grid view) ───────────
function IncomingRow({ entries, onAddAll, onDismissGroup, theme, exchangeRate, currencySymbol, displayCurrency, grid = false }) {
  const rep = entries[0];
  const count = entries.length;
  const [usdPrice, setUsdPrice] = useState('');
  const [localPrice, setLocalPrice] = useState('');
  const [platform, setPlatform] = useState('csfloat');
  const [notes, setNotes] = useState('');
  const [onHold, setOnHold] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleUsdChange = (val) => {
    setUsdPrice(val);
    setLocalPrice(exchangeRate && val && !isNaN(val)
      ? (parseFloat(val) * exchangeRate).toFixed(2) : '');
  };

  const handleLocalChange = (val) => {
    setLocalPrice(val);
    const usd = exchangeRate && val && !isNaN(val)
      ? (parseFloat(val) / exchangeRate).toFixed(2) : '';
    setUsdPrice(usd);
    if (val) setPlatform('youpin');
  };

  const submit = () => {
    const v = parseFloat(usdPrice);
    if (!v || v <= 0) return;
    setConfirming(true);
    const expectedDelivery = onHold
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    // Add each item in the group individually so per-item inspect data
    // (float, paint seed, stickers) rides through to the portfolio row.
    onAddAll(
      entries.map((entry) => ({
        itemName: entry.marketHashName,
        purchasePrice: v,
        platform,
        pending: onHold,
        expectedDelivery,
        notes,
        iconUrl: entry.iconUrl ? `${STEAM_IMG_BASE}${entry.iconUrl}/96fx96f` : null,
        floatValue: entry.floatValue,
        paintSeed: entry.paintSeed,
        paintIndex: entry.paintIndex,
        defIndex: entry.defIndex,
        stickers: entry.stickers,
        keychains: entry.keychains,
      }))
    );
  };

  return (
    <RowShell grid={grid} theme={theme}>
      <Cell grid={grid} theme={theme} className="px-3 py-2" gridClassName="pr-6">
        <div className="flex items-center gap-2 min-w-0">
          <ItemImage iconUrl={rep.iconUrl} alt={rep.marketHashName} size={grid ? 52 : 36} />
          <div className="min-w-0 flex-1">
            <p title={rep.marketHashName} className={`${grid ? `text-[13px] font-semibold ${theme.text} line-clamp-2` : `text-xs font-medium ${theme.textSecondary} truncate`} leading-tight`}>
              {rep.marketHashName}
            </p>
            <p className="text-[10px] text-slate-600 leading-tight">
              {new Date(rep.detectedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            <InspectBadges entry={rep} theme={theme} />
          </div>
          {count > 1 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${theme.accentBg} text-white flex-shrink-0`}>
              ×{count}
            </span>
          )}
        </div>
      </Cell>

      <Cell grid={grid} theme={theme} label="Price" className="px-3 py-2 align-middle">
        <PricePairCompact
          usdValue={usdPrice}
          localValue={localPrice}
          onUsdChange={handleUsdChange}
          onLocalChange={handleLocalChange}
          theme={theme}
          exchangeRate={exchangeRate}
          currencySymbol={currencySymbol}
          placeholderLocal={displayCurrency}
        />
      </Cell>

      <Cell grid={grid} theme={theme} label="Platform" inline className="px-3 py-2 align-middle">
        <div className="w-32">
          <PlatformPicker value={platform} onChange={setPlatform} theme={theme} platforms={PLATFORMS} compact />
        </div>
      </Cell>

      <Cell grid={grid} theme={theme} className="px-3 py-2 align-middle">
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes"
          className={`h-7 ${grid ? 'w-full' : 'w-28'} ${theme.input} rounded-lg px-2 text-xs ${theme.text} placeholder-slate-600 focus:outline-none border`}
        />
      </Cell>

      <Cell grid={grid} theme={theme} label="Trade hold" inline className="px-2 py-2 align-middle text-center">
        <button
          type="button"
          onClick={() => setOnHold(h => !h)}
          title={onHold ? 'Trade-protected (on hold)' : 'Not protected'}
          className={`h-7 w-7 rounded-lg border inline-flex items-center justify-center transition-all ${theme.card} ${theme.cardBorder} ${onHold ? 'text-warn' : 'text-slate-600'}`}
        >
          <Clock size={12} />
        </button>
      </Cell>

      <Cell grid={grid} theme={theme} className="px-3 py-2 align-middle text-right" gridClassName="mt-auto">
        <button
          type="button"
          disabled={confirming || !parseFloat(usdPrice)}
          onClick={submit}
          className={`h-7 px-3 rounded-lg border text-xs font-medium transition-all inline-flex items-center justify-center gap-1 ${grid ? 'w-full h-8' : ''}
            ${theme.card} ${theme.cardBorder} ${confirming ? 'text-profit' : theme.text}
            disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {confirming ? <><CheckCircle size={11} /> Added!</> : (count > 1 ? `Add ${count}` : 'Add')}
        </button>
      </Cell>

      <Cell grid={grid} theme={theme} className="px-2 py-2 align-middle text-right" gridClassName="absolute top-2 right-2">
        <button
          type="button"
          onClick={() => onDismissGroup(entries.map(e => e.assetid))}
          className="text-slate-600 hover:text-slate-300 p-1 rounded inline-flex"
          title="Dismiss"
        >
          <X size={13} />
        </button>
      </Cell>
    </RowShell>
  );
}

// ─── Compact outgoing row (returns React.Fragment with main + optional expansion row, or a card in grid view) ──
function OutgoingRow({ entry, candidates, allActiveItems, onMatch, onDismiss, theme, exchangeRate, currencySymbol, displayCurrency, grid = false }) {
  const [browseAll, setBrowseAll] = useState(candidates.length === 0);
  const [browseQuery, setBrowseQuery] = useState('');
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ? String(candidates[0].id) : '');
  const [usdSalePrice, setUsdSalePrice] = useState('');
  const [localSalePrice, setLocalSalePrice] = useState('');
  const [platform, setPlatform] = useState('csfloat');
  const [customFee, setCustomFee] = useState('');
  const [confirming, setConfirming] = useState(false);

  const browseResults = useMemo(() => {
    const q = browseQuery.toLowerCase().trim();
    const all = allActiveItems || [];
    const filtered = q
      ? all.filter((it) => (it.itemName || '').toLowerCase().includes(q))
      : all;
    return filtered.slice(0, 30).map((it) => ({ ...it, matchType: 'browse' }));
  }, [browseQuery, allActiveItems]);

  const visibleCandidates = browseAll ? browseResults : candidates;

  useEffect(() => {
    if (visibleCandidates.length === 0) { setSelectedId(''); return; }
    if (!visibleCandidates.some((c) => String(c.id) === selectedId)) {
      setSelectedId(String(visibleCandidates[0].id));
    }
  }, [visibleCandidates, selectedId]);

  const handleUsdChange = (val) => {
    setUsdSalePrice(val);
    setLocalSalePrice(exchangeRate && val && !isNaN(val)
      ? (parseFloat(val) * exchangeRate).toFixed(2) : '');
  };

  const handleLocalChange = (val) => {
    setLocalSalePrice(val);
    const usd = exchangeRate && val && !isNaN(val)
      ? (parseFloat(val) / exchangeRate).toFixed(2) : '';
    setUsdSalePrice(usd);
    if (val) setPlatform('youpin');
  };

  const submit = () => {
    const id = parseInt(selectedId, 10);
    const v = parseFloat(usdSalePrice);
    if (!id || !v || v <= 0) return;
    setConfirming(true);
    onMatch({ trackedId: id, salePrice: v, platform, customFee: customFee || undefined, assetid: entry.assetid });
  };

  const isFuzzyOnly =
    !browseAll && candidates.length > 0 && candidates.every((c) => c.matchType === 'fuzzy');

  const showExpansion = browseAll || isFuzzyOnly || platform === 'other';

  const selectedCandidate = visibleCandidates.find(c => String(c.id) === selectedId);
  const saleAmt = parseFloat(usdSalePrice);
  const fee = getPlatformFee(platform, customFee || undefined);
  const estProfit = (selectedCandidate && saleAmt > 0)
    ? Math.round(((saleAmt * (1 - fee)) - selectedCandidate.purchasePrice) * 100) / 100
    : null;
  const estProfitPct = (estProfit !== null && selectedCandidate?.purchasePrice > 0)
    ? (estProfit / selectedCandidate.purchasePrice) * 100
    : null;

  // Browse search / fuzzy warning / custom fee. An extra table row in list
  // view, the bottom of the card in grid view.
  const expansion = showExpansion && (
    <div className={`${grid ? '' : 'ml-12'} flex items-center gap-2 flex-wrap`}>
      {browseAll && (
        <input
          type="text"
          value={browseQuery}
          onChange={(e) => setBrowseQuery(e.target.value)}
          placeholder={`Search active items (${(allActiveItems || []).length} total)…`}
          className={`flex-1 max-w-md h-7 ${theme.input} rounded-lg px-2 text-xs ${theme.text} placeholder-slate-600 focus:outline-none border`}
        />
      )}
      {isFuzzyOnly && !browseAll && (
        <span className="text-[10px] text-warn">
          Near-matches only. Toggle Search to confirm the right item.
        </span>
      )}
      {platform === 'other' && (
        <div className="flex items-center gap-1">
          <input
            type="number" min="0" max="100" step="0.1"
            value={customFee}
            onChange={(e) => setCustomFee(e.target.value)}
            placeholder="Fee"
            className={`w-16 h-7 ${theme.input} rounded-lg px-2 ${theme.text} text-xs font-mono focus:outline-none border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          />
          <span className={`text-[10px] ${theme.subtext}`}>%</span>
        </div>
      )}
    </div>
  );

  return (
    <React.Fragment>
      <RowShell grid={grid} theme={theme}>
        <Cell grid={grid} theme={theme} className="px-3 py-2" gridClassName="pr-6">
          <div className="flex items-center gap-2 min-w-0">
            <ItemImage iconUrl={entry.iconUrl} alt={entry.marketHashName} size={grid ? 52 : 36} />
            <div className="min-w-0 flex-1">
              <p title={entry.marketHashName} className={`${grid ? `text-[13px] font-semibold ${theme.text} line-clamp-2` : `text-xs font-medium ${theme.textSecondary} truncate`} leading-tight`}>
                {entry.marketHashName}
              </p>
              <p className="text-[10px] text-slate-600 leading-tight">
                Gone {new Date(entry.detectedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              <InspectBadges entry={entry} theme={theme} />
            </div>
          </div>
        </Cell>

        <Cell grid={grid} theme={theme} label="Tracked match" className="px-3 py-2 align-middle">
          {visibleCandidates.length > 0 ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={`h-7 ${grid ? 'w-full' : 'w-48'} ${theme.input} rounded-lg px-2 text-xs ${theme.text} focus:outline-none border`}
            >
              {visibleCandidates.map((c) => (
                <option key={c.id} value={c.id}>{formatCandidateLabel(c)}</option>
              ))}
            </select>
          ) : (
            <span className="text-[10px] text-warn">No match — toggle Search {grid ? '↓' : '→'}</span>
          )}
        </Cell>

        <Cell grid={grid} theme={theme} label="Sale price" className="px-3 py-2 align-middle">
          <PricePairCompact
            usdValue={usdSalePrice}
            localValue={localSalePrice}
            onUsdChange={handleUsdChange}
            onLocalChange={handleLocalChange}
            theme={theme}
            exchangeRate={exchangeRate}
            currencySymbol={currencySymbol}
            placeholderUsd="Sold"
            placeholderLocal={displayCurrency}
          />
          {estProfit !== null && (
            <div className={`mt-1 rounded-md py-0.5 px-1.5 text-[10px] font-mono font-semibold text-center ${estProfit >= 0 ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
              {estProfit >= 0 ? '+' : ''}${estProfit.toFixed(2)}
              {estProfitPct !== null && <span className="opacity-60 ml-1">({estProfitPct >= 0 ? '+' : ''}{estProfitPct.toFixed(0)}%)</span>}
            </div>
          )}
        </Cell>

        <Cell grid={grid} theme={theme} label="Platform" inline className="px-3 py-2 align-middle">
          <div className="w-32">
            <PlatformPicker value={platform} onChange={(val) => { setPlatform(val); setCustomFee(val === 'other' ? '0' : ''); }} theme={theme} platforms={PLATFORMS} compact />
          </div>
        </Cell>

        <Cell grid={grid} theme={theme} label="Search all items" inline className="px-2 py-2 align-middle text-center">
          <button
            type="button"
            onClick={() => { setBrowseAll((prev) => !prev); setBrowseQuery(''); }}
            title={browseAll ? 'Back to suggestions' : 'Browse all tracked items'}
            className={`h-7 w-7 rounded-lg border inline-flex items-center justify-center transition-all ${theme.card} ${theme.cardBorder} ${browseAll ? theme.text : 'text-slate-600'}`}
          >
            <Search size={11} />
          </button>
        </Cell>

        {grid && expansion}

        <Cell grid={grid} theme={theme} className="px-3 py-2 align-middle text-right" gridClassName="mt-auto">
          <button
            type="button"
            disabled={confirming || !parseFloat(usdSalePrice) || !selectedId || isFuzzyOnly}
            onClick={submit}
            title={isFuzzyOnly ? 'No confident match — toggle Search to pick manually' : undefined}
            className={`h-7 px-3 rounded-lg border text-xs font-medium transition-all duration-300 active:scale-95 inline-flex items-center justify-center gap-1 ${grid ? 'w-full h-8' : ''}
              ${confirming ? 'bg-profit text-white border-transparent scale-95' : `${theme.card} ${theme.cardBorder} ${theme.text}`}
              disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {confirming ? <><CheckCircle size={11} /> Sold!</> : 'Mark sold'}
          </button>
        </Cell>

        <Cell grid={grid} theme={theme} className="px-2 py-2 align-middle text-right" gridClassName="absolute top-2 right-2">
          <button
            type="button"
            onClick={() => onDismiss(entry.assetid, 'outgoing')}
            className="text-slate-600 hover:text-slate-300 p-1 rounded inline-flex"
            title="Dismiss"
          >
            <X size={13} />
          </button>
        </Cell>
      </RowShell>

      {/* Expansion row (browse search / fuzzy warning / custom fee) */}
      {!grid && showExpansion && (
        <tr className={`border-b ${theme.cardBorder}`}>
          <td colSpan={7} className="px-3 pb-2.5 pt-0">
            {expansion}
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

// ─── Analytics ──────────────────────────────────────────────────────────────
function HandleStats({ items, incomingCount, outgoingCount, theme }) {
  const activity = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      months.push({ key, label, bought: 0, sold: 0 });
    }
    for (const it of items) {
      if (it.isTransaction) continue;
      if (it.datePurchased) {
        const m = (it.datePurchased + '').slice(0, 7);
        const found = months.find(x => x.key === m);
        if (found) found.bought += 1;
      }
      if (it.sold && it.dateSold) {
        const m = (it.dateSold + '').slice(0, 7);
        const found = months.find(x => x.key === m);
        if (found) found.sold += 1;
      }
    }
    return months;
  }, [items]);

  const totalReceived = items.filter(i => !i.isTransaction).length;
  const totalSold = items.filter(i => i.sold && !i.isTransaction).length;
  const monthBought = activity[activity.length - 1]?.bought ?? 0;
  const monthSold = activity[activity.length - 1]?.sold ?? 0;

  const statCards = [
    { label: 'Incoming queue', value: incomingCount, hint: 'pending review', icon: ArrowDownCircle, color: 'text-profit' },
    { label: 'Outgoing queue', value: outgoingCount, hint: 'awaiting match', icon: ArrowUpCircle, color: 'text-loss' },
    { label: 'This month', value: `${monthBought}↓ / ${monthSold}↑`, hint: 'bought / sold', plain: true },
    { label: 'All-time', value: `${totalReceived}↓ / ${totalSold}↑`, hint: 'received / sold', plain: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {statCards.map((card, i) => (
        <div key={i} className={`${theme.card} border ${theme.cardBorder} rounded-xl px-4 py-3`}>
          <div className="flex items-center gap-2 mb-1">
            {card.icon && <card.icon size={12} className={card.color} />}
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${theme.subtext}`}>{card.label}</p>
          </div>
          <p className={`text-lg font-mono font-semibold tabular-nums ${card.plain ? theme.text : card.color}`}>
            {card.value}
          </p>
          <p className={`text-xs ${theme.subtext}`}>{card.hint}</p>
        </div>
      ))}

      <div className={`${theme.card} border ${theme.cardBorder} rounded-xl px-3 py-2.5 flex flex-col`}>
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${theme.subtext} mb-1`}>
          Activity · 6 mo
        </p>
        <div className="flex-1 min-h-[60px]">
          <ResponsiveContainer width="100%" height={62}>
            <BarChart data={activity} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
              <CartesianGrid stroke={theme.chartGrid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: theme.chartAxis }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: theme.chartTooltipBg, border: `1px solid ${theme.chartTooltipBorder}`, borderRadius: 6, fontSize: 11, padding: '4px 8px' }}
                labelStyle={{ color: '#94a3b8', fontSize: 10 }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="bought" fill={PROFIT_COLOR} radius={[2, 2, 0, 0]} maxBarSize={10} />
              <Bar dataKey="sold" fill={LOSS_COLOR} radius={[2, 2, 0, 0]} maxBarSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ theme, text }) {
  return (
    <div className={`text-center py-10 text-sm ${theme.subtext}`}>{text}</div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function HandleItemsPage({
  theme,
  incoming = [],
  outgoing = [],
  onDismiss,
  items = [],
  addItemDirect,
  sellItemDirect,
  exchangeRate,
  currencySymbol = '¥',
  displayCurrency = 'CNY',
}) {
  const [tab, setTab] = useState('incoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-new');
  // Table or card view for incoming/outgoing, remembered per browser.
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('skinroi-handle-view') === 'grid' ? 'grid' : 'list'; } catch { return 'list'; }
  });
  useEffect(() => {
    try { localStorage.setItem('skinroi-handle-view', viewMode); } catch {}
  }, [viewMode]);

  const switchTab = (newTab) => {
    setTab(newTab);
    setSearchTerm('');
    setSortBy(newTab === 'outgoing' ? 'name-az' : 'date-new');
  };

  const isSortActive = (sort) => sortBy === sort.desc || sortBy === sort.asc;
  const handleSortClick = (sort) => {
    if (sortBy === sort.desc) setSortBy(sort.asc);
    else if (sortBy === sort.asc) setSortBy(sort.desc);
    else setSortBy(sort.desc);
  };
  const sortArrow = (sort) => {
    if (sortBy === sort.desc) return ' ↓';
    if (sortBy === sort.asc) return ' ↑';
    return '';
  };

  const activeByName = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (it.sold || it.pending || it.isTransaction) continue;
      const key = (it.itemName || '').toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.datePurchased || '').localeCompare(b.datePurchased || ''));
    }
    return map;
  }, [items]);

  const activeItems = useMemo(
    () => items
      .filter((it) => !it.sold && !it.isTransaction)
      .sort((a, b) => (a.itemName || '').localeCompare(b.itemName || '')),
    [items]
  );

  const candidatesFor = (entry) => {
    const key = (entry.marketHashName || '').toLowerCase();
    const exact = activeByName.get(key);
    if (exact && exact.length > 0) {
      return exact.map((it) => ({ ...it, matchType: 'exact' }));
    }
    const scored = [];
    for (const it of activeItems) {
      const score = nameMatchScore(entry.marketHashName, it.itemName);
      if (score >= 0.9) scored.push({ ...it, matchType: 'fuzzy', matchScore: score });
    }
    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored.slice(0, 10);
  };

  const incomingCount = incoming.length;
  const outgoingCount = outgoing.length;

  const visibleIncomingGroups = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const filtered = q
      ? incoming.filter(e => (e.marketHashName || '').toLowerCase().includes(q))
      : incoming;

    // Group by name + paintSeed + sticker fingerprint. Items with distinct
    // inspect data (float bucket, stickers) don't get lumped — otherwise
    // the row would show only the rep's float even though the group's
    // items differ. Items without inspect data (capsules, agents, keys)
    // still group by name as before.
    const inspectKey = (e) => {
      const seed = e.paintSeed != null ? `p${e.paintSeed}` : '';
      const stickers = Array.isArray(e.stickers) && e.stickers.length
        ? 's' + e.stickers.map((s) => s.stickerId).sort((a, b) => a - b).join(',')
        : '';
      const keychains = Array.isArray(e.keychains) && e.keychains.length
        ? 'k' + e.keychains.map((s) => s.stickerId).sort((a, b) => a - b).join(',')
        : '';
      return `${seed}|${stickers}|${keychains}`;
    };

    const groups = [];
    const seen = new Map();
    for (const entry of filtered) {
      const k = `${entry.marketHashName}::${inspectKey(entry)}`;
      if (!seen.has(k)) { seen.set(k, []); groups.push(seen.get(k)); }
      seen.get(k).push(entry);
    }

    return groups.sort((a, b) => {
      const x = a[0], y = b[0];
      switch (sortBy) {
        case 'date-old': return (x.detectedAt || 0) - (y.detectedAt || 0);
        case 'name-az':  return (x.marketHashName || '').localeCompare(y.marketHashName || '');
        case 'name-za':  return (y.marketHashName || '').localeCompare(x.marketHashName || '');
        case 'date-new':
        default:         return (y.detectedAt || 0) - (x.detectedAt || 0);
      }
    });
  }, [incoming, searchTerm, sortBy]);

  const visibleOutgoing = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const filtered = q
      ? outgoing.filter(e => (e.marketHashName || '').toLowerCase().includes(q))
      : outgoing;
    const arr = [...filtered];
    switch (sortBy) {
      case 'date-old': return arr.sort((x, y) => (x.detectedAt || 0) - (y.detectedAt || 0));
      case 'name-az':  return arr.sort((x, y) => (x.marketHashName || '').localeCompare(y.marketHashName || '') || (x.detectedAt || 0) - (y.detectedAt || 0));
      case 'name-za':  return arr.sort((x, y) => (y.marketHashName || '').localeCompare(x.marketHashName || '') || (x.detectedAt || 0) - (y.detectedAt || 0));
      case 'date-new':
      default:         return arr.sort((x, y) => (y.detectedAt || 0) - (x.detectedAt || 0));
    }
  }, [outgoing, searchTerm, sortBy]);

  const tableHeaderCls = `text-[10px] uppercase tracking-wide font-semibold ${theme.subtext}`;
  const grid = viewMode === 'grid';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-[600px] space-y-4">

        {/* Analytics */}
        <HandleStats items={items} incomingCount={incomingCount} outgoingCount={outgoingCount} theme={theme} />

        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <TabButton
            label="Incoming"
            count={incomingCount}
            isActive={tab === 'incoming'}
            onClick={() => switchTab('incoming')}
            theme={theme}
            accentColor={theme.accentColor}
            badgeClass={
              incomingCount > 0
                ? 'bg-profit/20 text-profit'
                : tab === 'incoming' ? `bg-white/15 ${theme.text}` : 'bg-white/5 text-slate-500'
            }
          />
          <TabButton
            label="Outgoing"
            count={outgoingCount}
            isActive={tab === 'outgoing'}
            onClick={() => switchTab('outgoing')}
            theme={theme}
            accentColor={theme.accentColor}
            badgeClass={
              outgoingCount > 0
                ? 'bg-loss/20 text-loss'
                : tab === 'outgoing' ? `bg-white/15 ${theme.text}` : 'bg-white/5 text-slate-500'
            }
          />
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tab === 'incoming' ? `Search ${incomingCount} incoming items…` : `Search ${outgoingCount} outgoing items…`}
              className={`w-full pl-8 pr-3 py-2 ${theme.card} border ${theme.cardBorder} rounded-lg text-sm ${theme.textSecondary} placeholder-slate-600 focus:outline-none transition-colors`}
            />
          </div>
          <div className={`flex items-center rounded-lg border ${theme.cardBorder} overflow-hidden`}>
            {SORTS.map((sort, i) => (
              <button
                key={sort.label}
                onClick={() => handleSortClick(sort)}
                className={`px-3 py-[7px] text-xs font-medium transition-colors whitespace-nowrap ${
                  i > 0 ? `border-l ${theme.cardBorder}` : ''
                } ${
                  isSortActive(sort)
                    ? `${theme.card} ${theme.textSecondary}`
                    : `text-slate-600 hover:text-slate-300 ${theme.itemHoverBg}`
                }`}
              >
                {sort.label}{sortArrow(sort)}
              </button>
            ))}
          </div>

          {/* View toggle — same as on Home */}
          <div className={`flex items-center rounded-lg border ${theme.cardBorder} overflow-hidden`}>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`px-2 py-[7px] transition-colors ${
                grid ? `${theme.card} ${theme.textSecondary}` : `text-slate-600 hover:text-slate-300 ${theme.itemHoverBg}`
              }`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`px-2 py-[7px] border-l ${theme.cardBorder} transition-colors ${
                !grid ? `${theme.card} ${theme.textSecondary}` : `text-slate-600 hover:text-slate-300 ${theme.itemHoverBg}`
              }`}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`${theme.panel} border ${theme.panelBorder} rounded-2xl shadow-lg overflow-x-auto`}>
          {tab === 'incoming' && (
            incoming.length === 0 ? (
              <EmptyState theme={theme} text="No new items detected. You're all caught up." />
            ) : visibleIncomingGroups.length === 0 ? (
              <EmptyState theme={theme} text={`No incoming items match "${searchTerm}".`} />
            ) : (
              <EntryList grid={grid} head={<>
                  <tr className={`border-b ${theme.cardBorder}`}>
                    <th className={`text-left px-3 py-2 ${tableHeaderCls}`}>Item</th>
                    <th className={`text-left px-3 py-2 ${tableHeaderCls}`}>Price</th>
                    <th className={`text-left px-3 py-2 ${tableHeaderCls}`}>Platform</th>
                    <th className={`text-left px-3 py-2 ${tableHeaderCls}`}>Notes</th>
                    <th className={`text-center px-2 py-2 ${tableHeaderCls}`}>Hold</th>
                    <th className={`text-right px-3 py-2 ${tableHeaderCls}`}>Action</th>
                    <th className="w-8"></th>
                  </tr>
                </>}>
                  {visibleIncomingGroups.map((group, i) => (
                    <IncomingRow
                      key={`in-${group[0].assetid}`}
                      entries={group}
                      theme={theme}
                      exchangeRate={exchangeRate}
                      currencySymbol={currencySymbol}
                      displayCurrency={displayCurrency}
                      onAddAll={(payloads) => {
                        // payloads is one entry per asset in the group so
                        // per-item inspect data (float, seed, stickers) is
                        // preserved on the resulting portfolio rows.
                        for (const p of payloads) addItemDirect(p);
                        onDismiss(group.map((e) => e.assetid), 'incoming');
                      }}
                      onDismissGroup={(ids) => onDismiss(ids, 'incoming')}
                      grid={grid}
                    />
                  ))}
              </EntryList>
            )
          )}

          {tab === 'outgoing' && (
            outgoing.length === 0 ? (
              <EmptyState theme={theme} text="No items have left your inventory since last sync." />
            ) : visibleOutgoing.length === 0 ? (
              <EmptyState theme={theme} text={`No outgoing items match "${searchTerm}".`} />
            ) : (
              <EntryList grid={grid} head={<>
                  <tr className={`border-b ${theme.cardBorder}`}>
                    <th className={`text-left px-3 py-2 ${tableHeaderCls}`}>Item</th>
                    <th className={`text-left px-3 py-2 ${tableHeaderCls}`}>Tracked match</th>
                    <th className={`text-left px-3 py-2 ${tableHeaderCls}`}>Sale price</th>
                    <th className={`text-left px-3 py-2 ${tableHeaderCls}`}>Platform</th>
                    <th className={`text-center px-2 py-2 ${tableHeaderCls}`}>Search</th>
                    <th className={`text-right px-3 py-2 ${tableHeaderCls}`}>Action</th>
                    <th className="w-8"></th>
                  </tr>
                </>}>
                  {visibleOutgoing.map((entry) => (
                    <OutgoingRow
                      key={`out-${entry.assetid}`}
                      entry={entry}
                      candidates={candidatesFor(entry)}
                      allActiveItems={activeItems}
                      theme={theme}
                      exchangeRate={exchangeRate}
                      currencySymbol={currencySymbol}
                      displayCurrency={displayCurrency}
                      onMatch={({ trackedId, salePrice, platform, customFee, assetid }) => {
                        const ok = sellItemDirect(trackedId, salePrice, platform, customFee);
                        if (ok) onDismiss(assetid, 'outgoing');
                      }}
                      onDismiss={onDismiss}
                      grid={grid}
                    />
                  ))}
              </EntryList>
            )
          )}
        </div>
        </div>
        <div className="hidden lg:flex w-[280px] shrink-0 flex-col gap-4 sticky top-0">
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${theme.subtext} mb-2 px-1`}>Recent Sales</p>
          <RecentSales items={items} theme={theme} />
        </div>
      </div>
    </div>
  );
}
