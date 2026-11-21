// Pieces shared by the Trades page's incoming and outgoing cards: name /
// date helpers, the card frame and image, price inputs and the hooks that
// fill them.
import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Lock, Unlock } from 'lucide-react';
import { Input } from '../../components/ui';
import { useLocalPriceSync } from '../../hooks/useLocalPriceSync';

export const SORT_OPTIONS = [
  { value: 'date-new', label: 'Newest first' },
  { value: 'date-old', label: 'Oldest first' },
  { value: 'name-az', label: 'Name A–Z' },
  { value: 'name-za', label: 'Name Z–A' },
];

export const STEAM_IMG_BASE = 'https://community.akamai.steamstatic.com/economy/image/';

export const WEAR_SHORT = {
  'Factory New': 'FN', 'Minimal Wear': 'MW', 'Field-Tested': 'FT', 'Well-Worn': 'WW', 'Battle-Scarred': 'BS',
};

export function splitName(name = '') {
  const m = name.match(/^(.*) \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/);
  return m ? { base: m[1], wear: m[2] } : { base: name, wear: null };
}

// detectedAt is an ISO string from the backend (the trade's accept time), so
// it has to be parsed before sorting — subtracting the strings gives NaN.
export const detectedMs = (e) => {
  const t = e?.detectedAt ? new Date(e.detectedAt).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
};

export function timeAgo(ms, now = Date.now()) {
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

export const fmtUsd = (v) => `$${Math.abs(v).toFixed(2)}`;
export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

// Small label on the item image.
export function Chip({ theme, warn = false, title, children }) {
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
export function CardMedia({ entry, count = 1, hold, onDismiss, theme }) {
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
export function CardTitle({ entry, theme, prefix }) {
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

export function Card({ theme, children }) {
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
export function PriceInputs({ usd, local, onUsd, onLocal, exchangeRate, currencySymbol, displayCurrency, theme }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input theme={theme} type="number" step="0.01" min="0" prefix="$" placeholder="USD" value={usd} onChange={(e) => onUsd(e.target.value)} />
      <Input theme={theme} type="number" step="0.01" min="0" prefix={currencySymbol} placeholder={displayCurrency} value={local} onChange={(e) => onLocal(e.target.value)} disabled={!exchangeRate} />
    </div>
  );
}

// Linked USD / local price state. Typing a local price picks YouPin, like the
// rest of the site.
export function usePricePair(exchangeRate, setPlatform) {
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
export function useCsfloatPrefill(csfloatPrice, exchangeRate, usdValue, setUsd, setLocal, setPlatform) {
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

export function ActionButton({ theme, done, doneLabel, disabled, onClick, title, children }) {
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
