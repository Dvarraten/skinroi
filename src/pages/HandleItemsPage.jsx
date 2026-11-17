import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, Search, Lock, Unlock, StickyNote, Inbox, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import PlatformPicker from '../components/PlatformPicker';
import { PlatformBadge } from '../components/PlatformBadge';
import { TabButton } from '../components/TabsAndSearchbar';
import PageHeader, { Page } from '../components/PageHeader';
import { Input, Select } from '../components/ui';
import { PLATFORMS } from '../utils/platforms';
import { getPlatformFee } from '../utils/platformFees';
import { useLocalPriceSync } from '../hooks/useLocalPriceSync';
import { tradeHoldStatus, tradeHoldEndsAt } from '../utils/tradeHold';
import { matchOutgoing } from '../utils/tradeMatch';

// Trades: Steam trades the extension found, as image-first cards. Incoming
// cards become portfolio items once the user enters what they paid; outgoing
// cards mark the matching portfolio item sold.

const SORT_OPTIONS = [
  { value: 'date-new', label: 'Newest first' },
  { value: 'date-old', label: 'Oldest first' },
  { value: 'name-az', label: 'Name A–Z' },
  { value: 'name-za', label: 'Name Z–A' },
];

const STEAM_IMG_BASE = 'https://community.akamai.steamstatic.com/economy/image/';

const WEAR_SHORT = {
  'Factory New': 'FN', 'Minimal Wear': 'MW', 'Field-Tested': 'FT', 'Well-Worn': 'WW', 'Battle-Scarred': 'BS',
};

function splitName(name = '') {
  const m = name.match(/^(.*) \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/);
  return m ? { base: m[1], wear: m[2] } : { base: name, wear: null };
}

// detectedAt is an ISO string from the backend (the trade's accept time), so
// it has to be parsed before sorting — subtracting the strings gives NaN.
const detectedMs = (e) => {
  const t = e?.detectedAt ? new Date(e.detectedAt).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
};

function timeAgo(ms, now = Date.now()) {
  if (!ms) return '';
  const min = Math.round((now - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const fmtUsd = (v) => `$${Math.abs(v).toFixed(2)}`;
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

// Small label on the item image.
function Chip({ theme, warn = false, title, children }) {
  const light = theme.name === 'Light';
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10px] font-semibold tracking-wide backdrop-blur-sm ${
        light ? 'bg-white/90 shadow-sm' : 'bg-black/55'
      } ${warn ? 'text-warn' : light ? 'text-zinc-700' : 'text-zinc-100'}`}
    >
      {children}
    </span>
  );
}

// The card's top half: the skin, large, with wear / count / hold / stickers
// as chips on it and the dismiss button in the corner.
function CardMedia({ entry, count = 1, hold, onDismiss, theme }) {
  const { wear } = splitName(entry.marketHashName);
  const stickers = Array.isArray(entry.stickers) ? entry.stickers : [];
  const keychains = Array.isArray(entry.keychains) ? entry.keychains : [];
  const extras = stickers.map((s) => s.name || `#${s.stickerId}`).concat(keychains.map((k) => `Charm #${k.stickerId}`));
  return (
    <div className="relative h-44 flex items-center justify-center px-6 bg-gradient-to-b from-zinc-500/[0.10] via-zinc-500/[0.04] to-transparent">
      {entry.iconUrl ? (
        <img
          src={`${STEAM_IMG_BASE}${entry.iconUrl}/256fx256f`}
          alt={entry.marketHashName || ''}
          loading="lazy"
          className="max-h-36 w-auto max-w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-zinc-500/10" />
      )}

      <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
        {wear && <Chip theme={theme} title={wear}>{WEAR_SHORT[wear]}</Chip>}
        {count > 1 && <Chip theme={theme} title={`${count} of this item in the trade`}>×{count}</Chip>}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        title="Dismiss"
        aria-label="Dismiss"
        className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-lg bg-black/40 text-zinc-300 hover:text-white hover:bg-black/60 transition md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X size={14} />
      </button>

      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between gap-1">
        {hold ? (
          hold.onHold ? (
            <Chip theme={theme} warn title={`Steam trade protection ends ${new Date(hold.endsAt).toLocaleString()}`}>
              <Lock size={10} /> Hold {hold.label}
            </Chip>
          ) : (
            <Chip theme={theme} title="Trade protection is over"><Unlock size={10} /> Tradeable</Chip>
          )
        ) : <span />}
        {extras.length > 0 && (
          <Chip theme={theme} title={extras.join(', ')}>
            {stickers.length > 0 && `${stickers.length} sticker${stickers.length > 1 ? 's' : ''}`}
            {stickers.length > 0 && keychains.length > 0 && ' · '}
            {keychains.length > 0 && `${keychains.length} charm${keychains.length > 1 ? 's' : ''}`}
          </Chip>
        )}
      </div>
    </div>
  );
}

// Name, float / seed and when the trade happened.
function CardTitle({ entry, theme, prefix }) {
  const { base } = splitName(entry.marketHashName);
  const facts = [
    typeof entry.floatValue === 'number' ? `Float ${entry.floatValue.toFixed(4)}` : null,
    typeof entry.paintSeed === 'number' ? `Seed ${entry.paintSeed}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="min-w-0">
      <h3 title={entry.marketHashName} className={`text-[14px] font-semibold leading-snug line-clamp-2 ${theme.text}`}>{base}</h3>
      <div className={`mt-0.5 flex items-center justify-between gap-2 text-[11px] ${theme.subtext}`}>
        <span className="truncate font-mono">{facts || ' '}</span>
        <span className="shrink-0" title={new Date(detectedMs(entry)).toLocaleString()}>{prefix}{timeAgo(detectedMs(entry))}</span>
      </div>
    </div>
  );
}

function Card({ theme, children }) {
  return (
    <article
      className={`group flex flex-col rounded-xl border overflow-hidden ${theme.panel} ${theme.cardBorder} ${theme.cardHover} transition-colors`}
      style={{ animation: 'fadeSlideIn 0.3s ease both' }}
    >
      {children}
    </article>
  );
}

// USD + local currency, side by side, linked through the exchange rate.
function PriceInputs({ usd, local, onUsd, onLocal, exchangeRate, currencySymbol, displayCurrency, theme }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input theme={theme} type="number" step="0.01" min="0" prefix="$" placeholder="USD" value={usd} onChange={(e) => onUsd(e.target.value)} />
      <Input theme={theme} type="number" step="0.01" min="0" prefix={currencySymbol} placeholder={displayCurrency} value={local} onChange={(e) => onLocal(e.target.value)} disabled={!exchangeRate} />
    </div>
  );
}

// Linked USD / local price state. Typing a local price picks YouPin, like the
// rest of the site.
function usePricePair(exchangeRate, setPlatform) {
  const [usd, setUsd] = useState('');
  const [local, setLocal] = useState('');
  useLocalPriceSync(usd, exchangeRate, setLocal);
  const onUsd = (val) => {
    setUsd(val);
    setLocal(exchangeRate && val && !isNaN(val) ? (parseFloat(val) * exchangeRate).toFixed(2) : '');
  };
  const onLocal = (val) => {
    setLocal(val);
    setUsd(exchangeRate && val && !isNaN(val) ? (parseFloat(val) / exchangeRate).toFixed(2) : '');
    if (val) setPlatform('youpin');
  };
  return { usd, local, setUsd, setLocal, onUsd, onLocal };
}

// Prefills a price pair from the CSFloat trade price the backend attached to a
// pending item (`csfloatPrice`, USD). Only fills while the field is empty or
// still holds the value we filled ourselves, so it never overwrites typing.
// Returns true while the shown USD value is the CSFloat one.
function useCsfloatPrefill(csfloatPrice, exchangeRate, usdValue, setUsd, setLocal, setPlatform) {
  const autoRef = useRef(null);
  useEffect(() => {
    if (csfloatPrice == null) return;
    if (usdValue !== '' && usdValue !== autoRef.current) return;
    const usd = csfloatPrice.toFixed(2);
    const firstFill = autoRef.current === null;
    autoRef.current = usd;
    if (usdValue !== usd) setUsd(usd);
    setLocal(exchangeRate ? (csfloatPrice * exchangeRate).toFixed(2) : '');
    if (firstFill) setPlatform('csfloat');
  }, [csfloatPrice, exchangeRate, usdValue, setUsd, setLocal, setPlatform]);
  return csfloatPrice != null && usdValue !== '' && usdValue === autoRef.current;
}

function ActionButton({ theme, done, doneLabel, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`w-full h-9 rounded-lg border text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition active:scale-[0.97]
        ${done ? 'border-transparent bg-profit/15 text-profit' : `${theme.cardBorder} ${theme.text} ${theme.itemHoverBg}`}
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {done ? <><Check size={14} /> {doneLabel}</> : children}
    </button>
  );
}

// ─── Incoming ───────────────────────────────────────────────────────────────
function IncomingCard({ entries, onAddAll, onDismissGroup, theme, exchangeRate, currencySymbol, displayCurrency }) {
  const rep = entries[0];
  const count = entries.length;
  const [platform, setPlatform] = useState('csfloat');
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const price = usePricePair(exchangeRate, setPlatform);
  const fromCsfloat = useCsfloatPrefill(rep.csfloatPrice, exchangeRate, price.usd, price.setUsd, price.setLocal, setPlatform);
  // Steam's 7-day trade protection, counted from when the trade was accepted.
  const hold = tradeHoldStatus(rep.detectedAt);

  const submit = () => {
    const v = parseFloat(price.usd);
    if (!v || v <= 0) return;
    setConfirming(true);
    // Add each item in the group individually so per-item inspect data
    // (float, paint seed, stickers) rides through to the portfolio row.
    // Items still under trade protection go in as on hold until it ends;
    // App promotes them by itself once expectedDelivery has passed.
    onAddAll(entries.map((entry) => {
      const h = tradeHoldStatus(entry.detectedAt);
      return {
        itemName: entry.marketHashName,
        purchasePrice: v,
        acquiredAt: detectedMs(entry) || null,
        platform,
        pending: h.onHold,
        expectedDelivery: h.onHold ? tradeHoldEndsAt(entry.detectedAt) : null,
        notes,
        iconUrl: entry.iconUrl ? `${STEAM_IMG_BASE}${entry.iconUrl}/96fx96f` : null,
        floatValue: entry.floatValue,
        paintSeed: entry.paintSeed,
        paintIndex: entry.paintIndex,
        defIndex: entry.defIndex,
        stickers: entry.stickers,
        keychains: entry.keychains,
        assetid: entry.assetid,
      };
    }));
  };

  return (
    <Card theme={theme}>
      <CardMedia theme={theme} entry={rep} count={count} hold={hold} onDismiss={() => onDismissGroup(entries.map((e) => e.assetid))} />
      <div className="flex-1 flex flex-col gap-3 p-3.5 pt-3">
        <CardTitle entry={rep} theme={theme} />

        <div>
          <PriceInputs theme={theme} {...price} exchangeRate={exchangeRate} currencySymbol={currencySymbol} displayCurrency={displayCurrency} />
          {fromCsfloat && <p className={`mt-1 text-[11px] ${theme.subtext}`}>Price from your CSFloat trade</p>}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <PlatformPicker value={platform} onChange={setPlatform} theme={theme} platforms={PLATFORMS} />
          </div>
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            title={notesOpen ? 'Hide note' : 'Add a note'}
            aria-pressed={notesOpen}
            className={`h-9 w-9 shrink-0 rounded-lg border inline-flex items-center justify-center transition ${theme.cardBorder} ${notesOpen || notes ? theme.text : `${theme.subtext} ${theme.textHover}`}`}
          >
            <StickyNote size={14} />
          </button>
        </div>
        {notesOpen && (
          <Input theme={theme} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note" autoFocus />
        )}

        <div className="mt-auto">
          <ActionButton
            theme={theme}
            done={confirming}
            doneLabel="Added"
            disabled={confirming || !parseFloat(price.usd)}
            onClick={submit}
            title={hold.onHold ? `Added as on hold until ${fmtDate(hold.endsAt)}` : undefined}
          >
            {count > 1 ? `Add ${count} to portfolio` : 'Add to portfolio'}
          </ActionButton>
        </div>
      </div>
    </Card>
  );
}

// ─── Outgoing ───────────────────────────────────────────────────────────────
function candidateLabel(c) {
  const parts = [`${splitName(c.itemName).base}`, `$${c.purchasePrice.toFixed(2)}`];
  if (c.datePurchased) parts.push(fmtDate(c.datePurchased));
  if (c.matchType === 'fuzzy' && typeof c.matchScore === 'number') parts.push(`${Math.round(c.matchScore * 100)}% match`);
  return parts.join(' · ');
}

// The portfolio item this trade sold. With the same Steam assetid it is
// certain and shown as a fact; otherwise the user picks from same-name items
// or searches everything they hold.
function MatchPicker({ match, allActiveItems, selectedId, setSelectedId, theme }) {
  const { exact, candidates } = match;
  const [searching, setSearching] = useState(!exact && candidates.length === 0);
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    if (!searching) return candidates;
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return allActiveItems.filter((it) => (it.itemName || '').toLowerCase().includes(q)).slice(0, 30);
  }, [searching, query, candidates, allActiveItems]);

  useEffect(() => {
    if (exact) { setSelectedId(String(exact.id)); return; }
    if (options.length === 0) { setSelectedId(''); return; }
    if (!options.some((c) => String(c.id) === selectedId)) setSelectedId(String(options[0].id));
  }, [exact, options, selectedId, setSelectedId]);

  if (exact) {
    return (
      <div
        title="Same Steam item id as an item in your portfolio"
        className={`flex items-center gap-2 text-[12px] ${theme.textSecondary}`}
      >
        <span className="h-5 w-5 shrink-0 rounded-full inline-flex items-center justify-center bg-profit/15 text-profit">
          <Check size={12} />
        </span>
        <span className="min-w-0 truncate">
          Paid <span className={`font-mono font-medium ${theme.text}`}>${exact.purchasePrice.toFixed(2)}</span>
          {exact.datePurchased && <span className={theme.subtext}> · {fmtDate(exact.datePurchased)}</span>}
        </span>
        {exact.platform && <span className="ml-auto shrink-0"><PlatformBadge platform={exact.platform} size="xs" /></span>}
      </div>
    );
  }

  const fuzzyOnly = !searching && candidates.length > 0 && candidates.every((c) => c.matchType === 'fuzzy');
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className={`text-xs font-medium ${theme.subtext}`}>Which item was it?</span>
        {candidates.length > 0 && (
          <button
            type="button"
            onClick={() => { setSearching((s) => !s); setQuery(''); }}
            className={`text-[11px] inline-flex items-center gap-1 ${theme.subtext} ${theme.textHover}`}
          >
            {searching ? <><X size={11} /> Back</> : <><Search size={11} /> Search all</>}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {searching && (
          <Input theme={theme} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your items…" prefix={<Search size={13} />} />
        )}
        {options.length > 0 && (
          <Select
            theme={theme}
            value={selectedId}
            onChange={setSelectedId}
            ariaLabel="Portfolio item"
            options={options.map((c) => ({ value: String(c.id), label: candidateLabel(c) }))}
          />
        )}
        {searching && query.trim() && options.length === 0 && (
          <p className={`text-[11px] ${theme.subtext}`}>None of your items match.</p>
        )}
        {fuzzyOnly && <p className="text-[11px] text-warn">Only similar names found. Check it is the right item.</p>}
      </div>
    </div>
  );
}

function OutgoingCard({ entry, items, allActiveItems, onMatch, onDismiss, theme, exchangeRate, currencySymbol, displayCurrency }) {
  const match = useMemo(() => matchOutgoing(entry, items), [entry, items]);
  const [selectedId, setSelectedId] = useState(match.exact ? String(match.exact.id) : '');
  const [platform, setPlatform] = useState('csfloat');
  const [customFee, setCustomFee] = useState('');
  const [confirming, setConfirming] = useState(false);
  const price = usePricePair(exchangeRate, setPlatform);
  const fromCsfloat = useCsfloatPrefill(entry.csfloatPrice, exchangeRate, price.usd, price.setUsd, price.setLocal, setPlatform);

  const selected = match.exact || items.find((it) => String(it.id) === selectedId) || null;
  const saleAmt = parseFloat(price.usd);
  const fee = getPlatformFee(platform, customFee || undefined);
  const estProfit = selected && saleAmt > 0
    ? Math.round((saleAmt * (1 - fee) - selected.purchasePrice) * 100) / 100
    : null;
  const estPct = estProfit !== null && selected.purchasePrice > 0 ? (estProfit / selected.purchasePrice) * 100 : null;

  const submit = () => {
    if (!selected || !(saleAmt > 0)) return;
    setConfirming(true);
    onMatch({ trackedId: selected.id, salePrice: saleAmt, platform, customFee: customFee || undefined, assetid: entry.assetid });
  };

  return (
    <Card theme={theme}>
      <CardMedia theme={theme} entry={entry} onDismiss={() => onDismiss(entry.assetid, 'outgoing')} />
      <div className="flex-1 flex flex-col gap-3 p-3.5 pt-3">
        <CardTitle entry={entry} theme={theme} prefix="Sent " />

        <MatchPicker match={match} allActiveItems={allActiveItems} selectedId={selectedId} setSelectedId={setSelectedId} theme={theme} />

        <div>
          <PriceInputs theme={theme} {...price} exchangeRate={exchangeRate} currencySymbol={currencySymbol} displayCurrency={displayCurrency} />
          {fromCsfloat && <p className={`mt-1 text-[11px] ${theme.subtext}`}>Price from your CSFloat trade</p>}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <PlatformPicker
              value={platform}
              onChange={(val) => { setPlatform(val); setCustomFee(val === 'other' ? '0' : ''); }}
              theme={theme}
              platforms={PLATFORMS}
            />
          </div>
          {platform === 'other' && (
            <Input theme={theme} type="number" min="0" max="100" step="0.1" suffix="%" placeholder="Fee" value={customFee} onChange={(e) => setCustomFee(e.target.value)} className="w-24 shrink-0" />
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2.5">
          {estProfit !== null && (
            <div className="flex items-baseline justify-between text-[12px]">
              <span className={theme.subtext}>Profit after fees</span>
              <span className={`font-mono font-semibold ${estProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {estProfit >= 0 ? '+' : '−'}{fmtUsd(estProfit)}
                {estPct !== null && <span className="opacity-70 font-normal"> · {estPct >= 0 ? '+' : ''}{estPct.toFixed(0)}%</span>}
              </span>
            </div>
          )}
          <ActionButton
            theme={theme}
            done={confirming}
            doneLabel="Sold"
            disabled={confirming || !(saleAmt > 0) || !selected}
            onClick={submit}
          >
            Mark sold
          </ActionButton>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ theme, icon: Icon = Inbox, title, text }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-2">
      <span className={`h-11 w-11 rounded-full inline-flex items-center justify-center bg-zinc-500/10 ${theme.subtext}`}>
        <Icon size={18} />
      </span>
      <p className={`text-sm font-medium ${theme.text}`}>{title}</p>
      {text && <p className={`text-[13px] max-w-xs ${theme.subtext}`}>{text}</p>}
    </div>
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
  const [sortBy, setSortBy] = useState(() => {
    try {
      const saved = localStorage.getItem('skinroi-handle-sort');
      return SORT_OPTIONS.some((o) => o.value === saved) ? saved : 'date-new';
    } catch { return 'date-new'; }
  });
  useEffect(() => {
    try { localStorage.setItem('skinroi-handle-sort', sortBy); } catch {}
  }, [sortBy]);

  const switchTab = (next) => { setTab(next); setSearchTerm(''); };

  const activeItems = useMemo(
    () => items
      .filter((it) => !it.sold && !it.isTransaction)
      .sort((a, b) => (a.itemName || '').localeCompare(b.itemName || '')),
    [items]
  );

  const byQuery = (list) => {
    const q = searchTerm.toLowerCase().trim();
    return q ? list.filter((e) => (e.marketHashName || '').toLowerCase().includes(q)) : list;
  };
  const compare = (x, y) => {
    switch (sortBy) {
      case 'date-old': return detectedMs(x) - detectedMs(y);
      case 'name-az': return (x.marketHashName || '').localeCompare(y.marketHashName || '') || detectedMs(y) - detectedMs(x);
      case 'name-za': return (y.marketHashName || '').localeCompare(x.marketHashName || '') || detectedMs(y) - detectedMs(x);
      case 'date-new':
      default: return detectedMs(y) - detectedMs(x);
    }
  };

  const visibleIncomingGroups = useMemo(() => {
    // Group by name + paintSeed + sticker fingerprint. Items with distinct
    // inspect data (float bucket, stickers) don't get lumped — otherwise
    // the card would show only the rep's float even though the group's
    // items differ. Items without inspect data (capsules, agents, keys)
    // still group by name.
    const inspectKey = (e) => {
      const seed = e.paintSeed != null ? `p${e.paintSeed}` : '';
      const stickers = Array.isArray(e.stickers) && e.stickers.length
        ? 's' + e.stickers.map((s) => s.stickerId).sort((a, b) => a - b).join(',')
        : '';
      const keychains = Array.isArray(e.keychains) && e.keychains.length
        ? 'k' + e.keychains.map((s) => s.stickerId).sort((a, b) => a - b).join(',')
        : '';
      // Different CSFloat prices must not collapse into one card with one price.
      const price = e.csfloatPrice != null ? `c${e.csfloatPrice}` : '';
      // Different trade days have different hold end times.
      const day = e.detectedAt ? String(e.detectedAt).slice(0, 10) : '';
      return `${seed}|${stickers}|${keychains}|${price}|${day}`;
    };
    const groups = [];
    const seen = new Map();
    for (const entry of byQuery(incoming)) {
      const k = `${entry.marketHashName}::${inspectKey(entry)}`;
      if (!seen.has(k)) { seen.set(k, []); groups.push(seen.get(k)); }
      seen.get(k).push(entry);
    }
    return groups.sort((a, b) => compare(a[0], b[0]));
  }, [incoming, searchTerm, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleOutgoing = useMemo(
    () => [...byQuery(outgoing)].sort(compare),
    [outgoing, searchTerm, sortBy] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Value of everything waiting to be handled, at the CSFloat trade price.
  // Trades that did not go through CSFloat have no price and are left out.
  const pendingValue = useMemo(() => {
    const all = [...incoming, ...outgoing];
    const priced = all.filter((e) => typeof e.csfloatPrice === 'number');
    return { value: priced.reduce((sum, e) => sum + e.csfloatPrice, 0), priced: priced.length, total: all.length };
  }, [incoming, outgoing]);

  const list = tab === 'incoming' ? incoming : outgoing;
  const shown = tab === 'incoming' ? visibleIncomingGroups : visibleOutgoing;
  const gridCls = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]';

  return (
    <Page>
      <PageHeader
        theme={theme}
        title="Trades"
        hint="Steam trades found by the extension. Confirm the price and they join your portfolio."
      >
        {pendingValue.priced > 0 && (
          <p className={`text-[13px] ${theme.subtext}`}>
            Waiting{' '}
            <span className={`font-mono font-medium ${theme.text}`}>≈ {fmtUsd(pendingValue.value)}</span>
            {pendingValue.priced < pendingValue.total && ` · ${pendingValue.priced} of ${pendingValue.total} priced`}
          </p>
        )}
      </PageHeader>

      {/* Tabs left, search + sort right, on one line above the cards. */}
      <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:border-b ${theme.cardBorder} mb-5`}>
        <div className={`flex items-center gap-6 w-full sm:w-auto border-b sm:border-b-0 ${theme.cardBorder}`}>
          <TabButton label="Incoming" count={incoming.length} isActive={tab === 'incoming'} onClick={() => switchTab('incoming')} theme={theme} accentColor={theme.accentColor} badgeClass={theme.subtext} />
          <TabButton label="Outgoing" count={outgoing.length} isActive={tab === 'outgoing'} onClick={() => switchTab('outgoing')} theme={theme} accentColor={theme.accentColor} badgeClass={theme.subtext} />
        </div>
        {list.length > 0 && (
          <div className="flex items-center gap-2 sm:pb-2.5 w-full sm:w-auto">
            <Input
              theme={theme}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search"
              prefix={<Search size={13} />}
              className="flex-1 sm:flex-none sm:w-56 !h-8"
            />
            <Select theme={theme} compact value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} ariaLabel="Sort" align="right" className="w-36 shrink-0" />
          </div>
        )}
      </div>

      {list.length === 0 ? (
        tab === 'incoming'
          ? <EmptyState theme={theme} icon={ArrowDownLeft} title="No new items" text="Items you receive in Steam trades show up here. You're all caught up." />
          : <EmptyState theme={theme} icon={ArrowUpRight} title="Nothing sent" text="Items that leave your inventory in a trade show up here." />
      ) : shown.length === 0 ? (
        <EmptyState theme={theme} icon={Search} title={`Nothing matches "${searchTerm}"`} />
      ) : tab === 'incoming' ? (
        <div className={gridCls}>
          {visibleIncomingGroups.map((group) => (
            <IncomingCard
              key={`in-${group[0].assetid}`}
              entries={group}
              theme={theme}
              exchangeRate={exchangeRate}
              currencySymbol={currencySymbol}
              displayCurrency={displayCurrency}
              onAddAll={(payloads) => {
                for (const p of payloads) addItemDirect(p);
                onDismiss(group.map((e) => e.assetid), 'incoming');
              }}
              onDismissGroup={(ids) => onDismiss(ids, 'incoming')}
            />
          ))}
        </div>
      ) : (
        <div className={gridCls}>
          {visibleOutgoing.map((entry) => (
            <OutgoingCard
              key={`out-${entry.assetid}`}
              entry={entry}
              items={items}
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
            />
          ))}
        </div>
      )}
    </Page>
  );
}
