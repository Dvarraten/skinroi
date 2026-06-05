// Tab bar (Active / Pending / Sold) with item counts, free-text search,
// segmented sort control, stacked-view toggle, and bulk-delete select mode.
import React from "react";
import { Search, MousePointer2, LayoutGrid, List } from "lucide-react";

const SORTS = {
  active: [
    { label: 'Date',     desc: 'newest',        asc: 'oldest'        },
    { label: 'Price',    desc: 'price-high',    asc: 'price-low'     },
    { label: 'Delivery', desc: 'delivery-late', asc: 'delivery-soon' },
  ],
  pending: [
    { label: 'Date',     desc: 'newest',          asc: 'oldest'           },
    { label: 'Price',    desc: 'price-high',      asc: 'price-low'        },
    { label: 'Delivery', desc: 'delivery-late',   asc: 'delivery-soon'    },
  ],
  sold: [
    { label: 'Date',     desc: 'newest',              asc: 'oldest'             },
    { label: 'Price',    desc: 'price-high',           asc: 'price-low'          },
    { label: 'Profit $', desc: 'profit-dollar-high',   asc: 'profit-dollar-low'  },
    { label: 'Profit %', desc: 'profit-high',          asc: 'profit-low'         },
  ],
};

export function TabButton({ label, count, isActive, onClick, theme, accentColor, badgeClass }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-[11px] font-semibold uppercase tracking-widest transition-all border flex items-center gap-2 group overflow-hidden rounded-lg ${
        isActive
          ? `${theme.card} ${theme.cardBorder} ${theme.text}`
          : `bg-transparent ${theme.cardBorder} ${theme.subtext} ${theme.textHover} hover:bg-white/5`
      }`}
    >
      <span>{label}</span>
      <span className={`text-[10px] font-semibold font-mono rounded-full px-1.5 py-0.5 ${badgeClass}`}>
        {count}
      </span>
      <span
        className={`absolute bottom-0 left-0 h-[2px] transition-all duration-200 ${isActive ? "w-full" : "w-0 group-hover:w-full"}`}
        style={{ backgroundColor: accentColor }}
      />
    </button>
  );
}

export default function TabsAndSearchbar({
  theme, setActiveTab, activeTab, stats, searchTerm, setSearchTerm, sortBy, setSortBy,
  selectMode, selectedIds, onEnterSelectMode, onCancelSelectMode, onConfirmBulkDelete,
  viewMode, setViewMode,
}) {
  const sorts = SORTS[activeTab] ?? SORTS.active;

  const isSortActive = (sort) => sortBy === sort.desc || sortBy === sort.asc;

  const handleSortClick = (sort) => {
    if (sortBy === sort.desc) setSortBy(sort.asc);
    else if (sortBy === sort.asc) setSortBy(sort.desc);
    else setSortBy(sort.desc);
  };

  const sortArrow = (sort) => {
    if (sortBy === sort.desc) return ' ↓';
    if (sortBy === sort.asc)  return ' ↑';
    return '';
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSortBy('newest');
  };

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <TabButton
          label="Active" count={stats.totalActiveCount}
          isActive={activeTab === 'active'} onClick={() => switchTab('active')}
          theme={theme} accentColor={theme.accentColor}
          badgeClass={activeTab === 'active' ? `bg-white/15 ${theme.text}` : 'bg-white/5 text-slate-500'}
        />
        <TabButton
          label="Pending" count={stats.totalPending}
          isActive={activeTab === 'pending'} onClick={() => switchTab('pending')}
          theme={theme} accentColor={theme.accentColor}
          badgeClass={
            stats.totalPending > 0
              ? 'bg-warn/20 text-warn'
              : activeTab === 'pending' ? `bg-white/15 ${theme.text}` : 'bg-white/5 text-slate-500'
          }
        />
        <TabButton
          label="Sold" count={stats.totalSoldCount}
          isActive={activeTab === 'sold'} onClick={() => switchTab('sold')}
          theme={theme} accentColor={theme.accentColor}
          badgeClass={activeTab === 'sold' ? `bg-white/15 ${theme.text}` : 'bg-white/5 text-slate-500'}
        />
      </div>

      {/* Search + segmented sort + stacked toggle + select */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search items…"
            className={`w-full pl-8 pr-3 py-2 ${theme.card} border ${theme.cardBorder} rounded-lg text-sm ${theme.textSecondary} placeholder-slate-600 focus:outline-none transition-colors`}
          />
        </div>

        {/* Segmented sort control */}
        <div className={`flex items-center rounded-lg border ${theme.cardBorder} overflow-hidden`}>
          {sorts.map((sort, i) => (
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

        {/* View toggle */}
        {setViewMode && (
          <div className={`flex items-center rounded-lg border ${theme.cardBorder} overflow-hidden`}>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`px-2 py-[7px] transition-colors ${
                viewMode === 'grid'
                  ? `${theme.card} ${theme.textSecondary}`
                  : `text-slate-600 hover:text-slate-300 ${theme.itemHoverBg}`
              }`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`px-2 py-[7px] border-l ${theme.cardBorder} transition-colors ${
                viewMode === 'list'
                  ? `${theme.card} ${theme.textSecondary}`
                  : `text-slate-600 hover:text-slate-300 ${theme.itemHoverBg}`
              }`}
            >
              <List size={14} />
            </button>
          </div>
        )}

        {/* Divider + Select — pushed to far right */}
        <div className="h-5 w-px bg-slate-600/40 ml-auto" />
        {!selectMode ? (
          <button
            onClick={onEnterSelectMode}
            className={`flex items-center gap-1.5 text-xs px-3 py-[7px] rounded-lg border ${theme.cardBorder} ${theme.subtext} ${theme.textHover} transition-colors`}
          >
            <MousePointer2 size={12} />
            Select
          </button>
        ) : (
          <>
            <span className={`text-xs ${theme.subtext}`}>{selectedIds?.size || 0} selected</span>
            <button
              onClick={onConfirmBulkDelete}
              disabled={!selectedIds || selectedIds.size === 0}
              className="text-xs px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-40 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={onCancelSelectMode}
              className={`text-xs px-3 py-2 rounded-lg border ${theme.cardBorder} ${theme.subtext} ${theme.textHover} transition-colors`}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
