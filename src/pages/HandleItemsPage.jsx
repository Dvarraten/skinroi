import React, { useEffect, useMemo, useState } from 'react';
import { Search, Inbox, ArrowDownLeft, ArrowUpRight, Puzzle } from 'lucide-react';
import { TabButton } from '../components/TabsAndSearchbar';
import PageHeader, { Page } from '../components/PageHeader';
import { Input, Select } from '../components/ui';
import ExtensionPairPanel from '../components/ExtensionPairPanel';
import { SORT_OPTIONS, detectedMs, fmtUsd } from './trades/cardParts';
import IncomingCard from './trades/IncomingCard';
import OutgoingCard from './trades/OutgoingCard';

// Trades: Steam trades the extension found, as image-first cards. Incoming
// cards become portfolio items once the user enters what they paid; outgoing
// cards mark the matching portfolio item sold.
// The cards live in ./trades/.

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

// Signed in but no extension paired: nothing will ever show up here, so say
// how to fix that instead of "You're all caught up".
function NotPairedState({ theme, extension, onChange }) {
  return (
    <div className="flex flex-col items-center text-center py-14 gap-2">
      <span className={`h-11 w-11 rounded-full inline-flex items-center justify-center bg-zinc-500/10 ${theme.subtext}`}>
        <Puzzle size={18} />
      </span>
      <p className={`text-sm font-medium ${theme.text}`}>Pair the extension to see your trades</p>
      <p className={`text-[13px] max-w-sm ${theme.subtext}`}>
        The SkinROI extension reads your accepted Steam trades and sends them here. Install it, then generate a code and paste it into the extension.
      </p>
      <div className="mt-4 w-full max-w-md text-left">
        <ExtensionPairPanel theme={theme} extension={extension} onChange={onChange} />
      </div>
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
  extension = null,
  refreshState,
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

      {list.length === 0 && extension && !extension.connected ? (
        <NotPairedState theme={theme} extension={extension} onChange={refreshState} />
      ) : list.length === 0 ? (
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
