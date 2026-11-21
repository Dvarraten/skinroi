import React, { useState } from 'react';
import { StickyNote } from 'lucide-react';
import PlatformPicker from '../../components/PlatformPicker';
import { Input } from '../../components/ui';
import { PLATFORMS } from '../../utils/platforms';
import { tradeHoldStatus, tradeHoldEndsAt } from '../../utils/tradeHold';
import { STEAM_IMG_BASE, detectedMs, fmtDate, CardMedia, CardTitle, Card, PriceInputs, usePricePair, useCsfloatPrefill, ActionButton } from './cardParts';

// ─── Incoming ───────────────────────────────────────────────────────────────
export default function IncomingCard({ entries, onAddAll, onDismissGroup, theme, exchangeRate, currencySymbol, displayCurrency }) {
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
