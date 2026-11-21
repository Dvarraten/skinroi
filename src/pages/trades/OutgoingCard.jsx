import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, Search } from 'lucide-react';
import PlatformPicker from '../../components/PlatformPicker';
import { PlatformBadge } from '../../components/PlatformBadge';
import { Input, Select } from '../../components/ui';
import { PLATFORMS } from '../../utils/platforms';
import { getPlatformFee } from '../../utils/platformFees';
import { matchOutgoing } from '../../utils/tradeMatch';
import { splitName, fmtUsd, fmtDate, CardMedia, CardTitle, Card, PriceInputs, usePricePair, useCsfloatPrefill, ActionButton } from './cardParts';

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

export default function OutgoingCard({ entry, items, allActiveItems, onMatch, onDismiss, theme, exchangeRate, currencySymbol, displayCurrency }) {
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
