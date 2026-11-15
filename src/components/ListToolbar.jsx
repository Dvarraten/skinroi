// Toolbar above an item list: search, sort and grid / list switch, with room
// for the caller's own actions on the right. Used on Home and Handle items.
//
// sorts: [{ label, desc, asc }] — clicking the active sort flips its direction.
import React from "react";
import { Search, LayoutGrid, List, ArrowDown, ArrowUp, X } from "lucide-react";
import Segmented from "./ui/Segmented";
import { useTheme } from "../themes/ThemeContext";

export const PORTFOLIO_SORTS = [
  { label: 'Date',     desc: 'newest',        asc: 'oldest'        },
  { label: 'Price',    desc: 'price-high',    asc: 'price-low'     },
  { label: 'Delivery', desc: 'delivery-late', asc: 'delivery-soon' },
];

export default function ListToolbar({
  searchTerm, setSearchTerm, placeholder = "Search items…",
  sorts = PORTFOLIO_SORTS, sortBy, setSortBy,
  viewMode, setViewMode,
  actions = null,
}) {
  const theme = useTheme();

  const sortItems = sorts.map((sort) => {
    const active = sortBy === sort.desc || sortBy === sort.asc;
    const descending = sortBy === sort.desc;
    const Arrow = descending ? ArrowDown : ArrowUp;
    return {
      key: sort.label,
      // Arrow after the label, only on the active sort.
      label: active ? <>{sort.label}<Arrow size={12} strokeWidth={2.25} /></> : sort.label,
      active,
      title: active
        ? `Sorted by ${sort.label.toLowerCase()}. Click to reverse.`
        : `Sort by ${sort.label.toLowerCase()}`,
      onClick: () => setSortBy(descending ? sort.asc : sort.desc),
    };
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative w-full sm:w-72">
        <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${theme.subtext}`} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className={`w-full h-8 pl-9 pr-8 ${theme.card} border ${theme.cardBorder} rounded-lg text-[13px] ${theme.text} placeholder-slate-500 focus:outline-none transition-colors`}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            title="Clear search"
            aria-label="Clear search"
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md ${theme.subtext} ${theme.textHover}`}
          >
            <X size={13} />
          </button>
        )}
      </div>

      <Segmented label="Sort" items={sortItems} />

      {setViewMode && (
        <Segmented
          label="View"
          items={[
            { key: 'grid', title: 'Grid view', icon: <LayoutGrid size={14} />, active: viewMode === 'grid', onClick: () => setViewMode('grid') },
            { key: 'list', title: 'List view', icon: <List size={14} />,       active: viewMode === 'list', onClick: () => setViewMode('list') },
          ]}
        />
      )}

      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
